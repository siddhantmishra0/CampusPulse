import { z } from 'zod';

export const authorizeSubmissionSchema = z.object({
  body: z.object({
    campaignId: z.string().uuid(),
  }),
});

export const submitFeedbackSchema = z.object({
  body: z.object({
    submissionToken: z.string().min(1),
    source: z.enum(['TRADITIONAL', 'CONVERSATIONAL']),
    responses: z.array(
      z.object({
        question: z.string().optional(),
        answer: z.string().min(1),
      })
    ).min(1),
  }),
});
