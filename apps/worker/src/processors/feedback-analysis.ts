import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';
import { prisma } from '../lib/db';
import { llm } from '../lib/llm';
import { FeedbackAnalysisSchema } from '@campuspulse/shared';

export const feedbackAnalysisWorker = new Worker('feedback-analysis', async (job: Job<{ submissionId: string }>) => {
  const { submissionId } = job.data;
  logger.info(`Processing feedback analysis job ${job.id} for submission ${submissionId}`);

  // 1. Fetch submission + responses
  const submission = await prisma.feedbackSubmission.findUnique({
    where: { id: submissionId },
    include: {
      responses: true,
      campaign: {
        select: {
          title: true,
          description: true,
          tenantId: true,
        },
      },
    },
  });

  if (!submission) {
    throw new Error(`Submission ${submissionId} not found.`);
  }

  // Idempotency: Ensure we haven't already analyzed this
  const existingAnalysis = await prisma.feedbackAnalysis.findUnique({
    where: { feedbackSubmissionId: submissionId },
  });
  if (existingAnalysis) {
    logger.info(`Skipping: Submission ${submissionId} already analyzed.`);
    return { success: true, message: 'Already analyzed' };
  }

  // 2. Format Q&A pairs into a text prompt
  const qaText = submission.responses
    .map((r: any) => `Q: ${r.question}\nA: ${r.answer}`)
    .join('\n\n');

  const systemPrompt = `You are an AI tasked with analyzing student feedback.
Campaign Title: ${submission.campaign.title}
Campaign Description: ${submission.campaign.description ?? 'None'}

Please analyze the following feedback and extract structured information according to the schema provided.
- sentiment: Choose exactly one: POSITIVE, NEUTRAL, NEGATIVE, MIXED
- topics: An array of key topics mentioned, with a confidence score (0-1).
- issues: An array of actionable issues (e.g. "Broken projector in Room 101"). Categorize them appropriately (e.g., "FACILITY", "ACADEMIC", "ADMINISTRATIVE").
- summary: A concise 1-2 sentence summary of the entire feedback.
`;

  // 3. Invoke LLM with structured output
  const structuredLlm = llm.withStructuredOutput(FeedbackAnalysisSchema, {
    name: 'extract_feedback_analytics',
  });

  const analysisData = await structuredLlm.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: qaText },
  ]);

  // 4. Save results in a transaction
  await prisma.$transaction(async (tx: any) => {
    // a. Create main analysis record
    const analysis = await tx.feedbackAnalysis.create({
      data: {
        feedbackSubmissionId: submission.id,
        sentiment: analysisData.sentiment,
        summary: analysisData.summary,
        modelVersion: analysisData.modelVersion,
      },
    });

    // b. Create topics
    if (analysisData.topics.length > 0) {
      await tx.feedbackTopic.createMany({
        data: analysisData.topics.map((t) => ({
          feedbackAnalysisId: analysis.id,
          name: t.name,
          confidence: t.confidence,
        })),
      });
    }

    // c. Create issues
    if (analysisData.issues.length > 0) {
      await tx.feedbackIssue.createMany({
        data: analysisData.issues.map((i) => ({
          feedbackAnalysisId: analysis.id,
          title: i.title,
          description: i.description,
          category: i.category,
        })),
      });
    }
  });

  logger.info(`Successfully analyzed submission ${submissionId}.`);
  return { success: true };
}, { connection: redis, concurrency: 5 });

feedbackAnalysisWorker.on('completed', (job) => {
  logger.info(`Feedback analysis job ${job.id} completed`);
});

feedbackAnalysisWorker.on('failed', (job, err) => {
  logger.error(`Feedback analysis job ${job?.id} failed`, { error: err.message });
});
