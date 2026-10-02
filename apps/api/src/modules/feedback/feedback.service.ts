import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { feedbackAnalysisQueue } from '../../lib/queue';
import { config } from '../../config/env';

interface SubmissionTokenPayload {
  campaignId: string;
  studentHash: string;
  type: 'SUBMISSION_TOKEN';
}

interface SubmitFeedbackInput {
  submissionToken: string;
  source: 'TRADITIONAL' | 'CONVERSATIONAL';
  responses: { question?: string; answer: string }[];
}

export class FeedbackService {
  /**
   * Issues a one-time submission token after verifying student eligibility.
   * The token contains the campaignId + a hash of the studentId (for deduplication),
   * but the studentId itself is never stored in the feedback record.
   */
  static async authorizeSubmission(tenantId: string, studentUserId: string, campaignId: string) {
    // 1. Verify campaign exists, belongs to tenant, and is ACTIVE
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, tenantId, status: 'ACTIVE', deletedAt: null },
    });
    if (!campaign) {
      const error = new Error('Campaign not found or not currently active');
      (error as any).statusCode = 404;
      throw error;
    }

    // 2. Create a deterministic hash of (studentUserId + campaignId + salt) for deduplication
    //    We hash to ensure the studentId is NOT recoverable from the token or database
    const salt = config.anonymityTokenSalt;
    const studentHash = crypto
      .createHmac('sha256', salt)
      .update(`${studentUserId}:${campaignId}`)
      .digest('hex');

    // 3. Check if student has already submitted (by checking token hash)
    const existingTokenHash = this.hashToken(`USED:${studentHash}`);
    const alreadyUsed = await redis.exists(`submission:used:${existingTokenHash}`);
    if (alreadyUsed) {
      const error = new Error('You have already submitted feedback for this campaign');
      (error as any).statusCode = 409;
      throw error;
    }

    // 4. Issue short-lived one-time submission JWT
    const payload: SubmissionTokenPayload = {
      campaignId,
      studentHash,
      type: 'SUBMISSION_TOKEN',
    };

    const token = jwt.sign(payload, config.submissionTokenSecret, { expiresIn: '30m' });

    // 5. Mark this token as "issued" in Redis (prevents double-issuance race)
    const issuedKey = `submission:issued:${studentHash}`;
    const alreadyIssued = await redis.exists(issuedKey);
    if (alreadyIssued) {
      const error = new Error('A submission token is already in progress. Please use your existing token.');
      (error as any).statusCode = 409;
      throw error;
    }
    await redis.setex(issuedKey, 1800, '1'); // 30 min TTL matches token expiry

    return { submissionToken: token };
  }

  /**
   * Submits feedback using a one-time token. The studentId is never stored.
   * Idempotency is guaranteed via Redis token revocation.
   */
  static async submitFeedback(tenantId: string, input: SubmitFeedbackInput) {
    // 1. Verify and decode submission token
    let payload: SubmissionTokenPayload;
    try {
      payload = jwt.verify(input.submissionToken, config.submissionTokenSecret) as SubmissionTokenPayload;
    } catch {
      const error = new Error('Invalid or expired submission token');
      (error as any).statusCode = 401;
      throw error;
    }

    if (payload.type !== 'SUBMISSION_TOKEN') {
      const error = new Error('Invalid token type');
      (error as any).statusCode = 400;
      throw error;
    }

    // 2. Ensure token has not already been used (revocation check)
    const tokenHash = this.hashToken(input.submissionToken);
    const revokedKey = `submission:revoked:${tokenHash}`;
    const isRevoked = await redis.exists(revokedKey);
    if (isRevoked) {
      const error = new Error('This submission token has already been used');
      (error as any).statusCode = 409;
      throw error;
    }

    // 3. Verify campaign still active
    const campaign = await prisma.campaign.findFirst({
      where: { id: payload.campaignId, tenantId, status: 'ACTIVE', deletedAt: null },
    });
    if (!campaign) {
      const error = new Error('Campaign is no longer active');
      (error as any).statusCode = 404;
      throw error;
    }

    // 4. Double-check for duplicate submission by studentHash
    const existingSubmission = await prisma.feedbackSubmission.findFirst({
      where: { 
        campaignId: payload.campaignId, 
        submissionTokenHash: payload.studentHash 
      },
    });
    if (existingSubmission) {
      const error = new Error('Feedback already submitted for this campaign');
      (error as any).statusCode = 409;
      throw error;
    }

    // 5. Store submission — NO studentId, only the hash
    const submission = await prisma.feedbackSubmission.create({
      data: {
        campaignId: payload.campaignId,
        submissionTokenHash: payload.studentHash, // hash only, not the studentId
        source: input.source,
        responses: {
          create: input.responses.map(r => ({
            question: r.question,
            answer: r.answer,
          })),
        },
      },
      include: { responses: true },
    });

    // 6. Revoke the token (atomic write) — stored for 2h to cover clock skew
    await redis.setex(revokedKey, 7200, '1');
    // Also clear the "issued" marker
    await redis.del(`submission:issued:${payload.studentHash}`);
    // Set "used" marker keyed by studentHash (for authorizeSubmission check) - no expiration
    await redis.set(`submission:used:${this.hashToken(`USED:${payload.studentHash}`)}`, '1');

    // 7. Enqueue analysis job
    await feedbackAnalysisQueue.add('analyze-feedback', {
      submissionId: submission.id,
      campaignId: payload.campaignId,
      tenantId,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return submission;
  }

  static async getSubmissionStatus(tenantId: string, submissionId: string) {
    const submission = await prisma.feedbackSubmission.findFirst({
      where: { id: submissionId },
      include: { 
        analysis: { select: { status: true, analyzedAt: true } },
        campaign: { where: { tenantId } },
      },
    });
    if (!submission || !submission.campaign) throw new Error('Submission not found');

    return {
      id: submission.id,
      submittedAt: submission.submittedAt,
      source: submission.source,
      analysisStatus: submission.analysis?.status ?? 'PENDING',
      analyzedAt: submission.analysis?.analyzedAt ?? null,
    };
  }

  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
