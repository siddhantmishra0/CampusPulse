import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { feedbackAnalysisQueue } from '../../lib/queue';
import { llm, llmStructured } from '../../lib/llm';
import { config } from '../../config/env';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

// ─── Token helpers (mirrors feedback.service logic) ─────────────────────────

interface SubmissionTokenPayload {
  campaignId: string;
  studentHash: string;
  iat: number;
  exp: number;
}

function verifySubmissionToken(token: string): SubmissionTokenPayload {
  return jwt.verify(token, config.submissionTokenSecret) as SubmissionTokenPayload;
}

function hashToken(token: string): string {
  return crypto.createHmac('sha256', config.submissionTokenSecret).update(token).digest('hex');
}

const REVOKED_KEY = (hash: string) => `revoked_submission:${hash}`;
const CONVERSATION_LOCK_KEY = (hash: string) => `conv_lock:${hash}`;

// ─── System prompt builder ───────────────────────────────────────────────────

function buildSystemPrompt(campaignTitle: string, campaignDescription: string | null): string {
  return [
    'You are a warm, empathetic feedback facilitator for a university department.',
    `You are gathering student feedback for the following campaign: "${campaignTitle}".`,
    campaignDescription ? `Campaign context: ${campaignDescription}` : '',
    '',
    'Your role is to:',
    '1. Ask one clear, focused follow-up question at a time based on the student\'s previous answer.',
    '2. Explore specific details when the student is vague.',
    '3. Acknowledge what the student says briefly before asking the next question.',
    '4. Keep responses concise — no more than 2–3 sentences.',
    '5. After 4–6 exchanges, thank the student and let them know they can submit their feedback.',
    '',
    'IMPORTANT: Do NOT ask for any personally identifying information.',
    'IMPORTANT: Stay focused only on the campaign topic.',
    'IMPORTANT: Do not promise any specific outcomes or changes.',
  ]
    .filter(Boolean)
    .join('\n');
}

// ─── Service ─────────────────────────────────────────────────────────────────

/** Start a new conversation, verify the submission token is still valid. */
export async function startConversation(submissionToken: string): Promise<{
  conversationId: string;
  firstMessage: string;
}> {
  // 1. Verify JWT
  let payload: SubmissionTokenPayload;
  try {
    payload = verifySubmissionToken(submissionToken);
  } catch {
    throw Object.assign(new Error('Invalid or expired submission token'), { statusCode: 401 });
  }

  // 2. Check if token is already revoked
  const tokenHash = hashToken(submissionToken);
  const isRevoked = await redis.get(REVOKED_KEY(tokenHash));
  if (isRevoked) {
    throw Object.assign(new Error('Submission token has already been used'), { statusCode: 409 });
  }

  // 3. Check if a conversation already exists for this token hash
  const existing = await prisma.conversation.findFirst({
    where: { sessionId: tokenHash },
  });
  if (existing) {
    // Return the existing conversation with its first AI message
    const firstMsg = await prisma.conversationMessage.findFirst({
      where: { conversationId: existing.id, role: 'ASSISTANT' },
      orderBy: { createdAt: 'asc' },
    });
    return {
      conversationId: existing.id,
      firstMessage: firstMsg?.content ?? 'Welcome back! Please continue sharing your thoughts.',
    };
  }

  // 4. Load campaign context
  const campaign = await prisma.campaign.findUnique({
    where: { id: payload.campaignId },
    select: { id: true, title: true, description: true, status: true },
  });
  if (!campaign || campaign.status !== 'ACTIVE') {
    throw Object.assign(new Error('Campaign is not active'), { statusCode: 400 });
  }

  // 5. Lock so concurrent requests don't create duplicate conversations
  const lockKey = CONVERSATION_LOCK_KEY(tokenHash);
  const locked = await redis.set(lockKey, '1', 'EX', 30, 'NX');
  if (!locked) {
    throw Object.assign(new Error('Conversation is already being created'), { statusCode: 409 });
  }

  // 6. Generate opening AI message
  const systemPrompt = buildSystemPrompt(campaign.title, campaign.description ?? null);
  const openingResponse = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage('Hello, I am ready to provide feedback.'),
  ]);
  const firstMessage = String(openingResponse.content);

  // 7. Persist conversation and first messages
  const conversation = await prisma.conversation.create({
    data: {
      campaignId: campaign.id,
      sessionId: tokenHash,
      status: 'ACTIVE',
      messages: {
        createMany: {
          data: [
            { role: 'SYSTEM', content: systemPrompt },
            { role: 'ASSISTANT', content: firstMessage },
          ],
        },
      },
    },
  });

  await redis.del(lockKey);

  return { conversationId: conversation.id, firstMessage };
}

/** Send a student message and receive an AI response. */
export async function sendMessage(
  conversationId: string,
  studentContent: string,
): Promise<{ messageId: string; reply: string }> {
  // 1. Load the conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      campaign: { select: { title: true, description: true } },
    },
  });
  if (!conversation) {
    throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });
  }
  if (conversation.status !== 'ACTIVE') {
    throw Object.assign(new Error('Conversation is no longer active'), { statusCode: 409 });
  }

  // 2. Build LangChain message history
  const history = conversation.messages
    .filter((m: any) => m.role !== 'SYSTEM')
    .map((m: any) => {
      if (m.role === 'ASSISTANT') return new AIMessage(m.content);
      return new HumanMessage(m.content);
    });

  const systemMsg = conversation.messages.find((m: any) => m.role === 'SYSTEM');
  const messages = [
    new SystemMessage(systemMsg?.content ?? buildSystemPrompt(conversation.campaign.title, conversation.campaign.description ?? null)),
    ...history,
    new HumanMessage(studentContent),
  ];

  // 3. Call LLM
  const aiResponse = await llm.invoke(messages);
  const replyContent = String(aiResponse.content);

  // 4. Persist student message + AI reply
  const [, aiMsg] = await prisma.$transaction([
    prisma.conversationMessage.create({
      data: { conversationId, role: 'USER', content: studentContent },
    }),
    prisma.conversationMessage.create({
      data: { conversationId, role: 'ASSISTANT', content: replyContent },
    }),
  ]);

  return { messageId: aiMsg.id, reply: replyContent };
}

/** Summarise the conversation and create a FeedbackSubmission. */
export async function submitConversation(
  conversationId: string,
  submissionToken: string,
  finalNote?: string,
): Promise<{ submissionId: string }> {
  // 1. Verify token
  let payload: SubmissionTokenPayload;
  try {
    payload = verifySubmissionToken(submissionToken);
  } catch {
    throw Object.assign(new Error('Invalid or expired submission token'), { statusCode: 401 });
  }
  const tokenHash = hashToken(submissionToken);

  // 2. Ensure token is not yet revoked
  const isRevoked = await redis.get(REVOKED_KEY(tokenHash));
  if (isRevoked) {
    throw Object.assign(new Error('Feedback already submitted'), { statusCode: 409 });
  }

  // 3. Load conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!conversation) {
    throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });
  }
  if (conversation.sessionId !== tokenHash) {
    throw Object.assign(new Error('Token does not match conversation'), { statusCode: 403 });
  }
  if (conversation.status === 'SUBMITTED') {
    throw Object.assign(new Error('Conversation already submitted'), { statusCode: 409 });
  }

  // 4. Build transcript for summarisation
  const userTurns = conversation.messages
    .filter((m: any) => m.role === 'USER')
    .map((m: any) => m.content)
    .join('\n\n');

  const fullTranscript = conversation.messages
    .filter((m: any) => m.role !== 'SYSTEM')
    .map((m: any) => `${m.role === 'USER' ? 'Student' : 'Assistant'}: ${m.content}`)
    .join('\n');

  // 5. Summarise with LLM
  const summaryPrompt = [
    'Summarise the following student feedback conversation into 3 structured fields.',
    'Return ONLY valid JSON with exactly these keys:',
    '  "strengths": string (what is working well, or empty string)',
    '  "improvements": string (what could be better, or empty string)',
    '  "general": string (other important points or overall summary)',
    '',
    finalNote ? `Student\'s final note: ${finalNote}` : '',
    '',
    'Transcript:',
    fullTranscript,
  ]
    .filter(Boolean)
    .join('\n');

  let summaryJson: { strengths: string; improvements: string; general: string };
  try {
    const summaryResponse = await llmStructured.invoke([new HumanMessage(summaryPrompt)]);
    const raw = String(summaryResponse.content)
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    summaryJson = JSON.parse(raw);
  } catch {
    // Fallback: store raw transcript as single response
    summaryJson = {
      strengths: '',
      improvements: '',
      general: userTurns || 'No feedback captured.',
    };
  }

  // 6. Revoke token immediately
  const tokenTtl = payload.exp - Math.floor(Date.now() / 1000);
  if (tokenTtl > 0) {
    await redis.set(REVOKED_KEY(tokenHash), '1', 'EX', tokenTtl + 60);
  }

  // 7. Create FeedbackSubmission + responses + mark conversation submitted
  const responses = [
    summaryJson.strengths && { question: 'What is working well?', answer: summaryJson.strengths },
    summaryJson.improvements && { question: 'What could be improved?', answer: summaryJson.improvements },
    { question: 'General feedback', answer: summaryJson.general },
    finalNote && { question: 'Final note from student', answer: finalNote },
  ].filter(Boolean) as { question: string; answer: string }[];

  const submission = await prisma.$transaction(async (tx: any) => {
    const sub = await tx.feedbackSubmission.create({
      data: {
        campaignId: payload.campaignId,
        submissionTokenHash: tokenHash,
        source: 'CONVERSATIONAL',
        responses: {
          createMany: { data: responses },
        },
      },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { status: 'SUBMITTED' },
    });
    return sub;
  });

  // 8. Enqueue analysis job
  await feedbackAnalysisQueue.add('analyze-feedback', {
    submissionId: submission.id,
    campaignId: payload.campaignId,
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });

  return { submissionId: submission.id };
}

/** Get a conversation's messages (for client to resume). */
export async function getConversation(conversationId: string): Promise<{
  id: string;
  status: string;
  messages: { role: string; content: string; createdAt: Date }[];
}> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        where: { role: { not: 'SYSTEM' } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!conversation) {
    throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });
  }
  return {
    id: conversation.id,
    status: conversation.status,
    messages: conversation.messages.map((m: any) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  };
}
