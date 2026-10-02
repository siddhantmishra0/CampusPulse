import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import {
  StartConversationSchema,
  SendMessageSchema,
  SubmitConversationSchema,
} from './conversations.schema';
import * as controller from './conversations.controller';

export const conversationsRouter: Router = Router();

// All conversation routes require a valid student JWT
conversationsRouter.use(authenticate);

// Wrapper schemas that match the validate middleware signature (validates req.body inside)
const startSchema = z.object({ body: StartConversationSchema });
const messageSchema = z.object({ body: SendMessageSchema });
const submitSchema = z.object({
  body: SubmitConversationSchema.extend({
    submissionToken: StartConversationSchema.shape.submissionToken,
  }),
});

/**
 * POST /api/v1/conversations/start
 * Body: { submissionToken: string }
 * → Creates a new conversation session and returns first AI message.
 */
conversationsRouter.post(
  '/start',
  validate(startSchema),
  controller.startConversation,
);

/**
 * GET /api/v1/conversations/:id
 * → Returns existing conversation messages (for reconnect/resume).
 */
conversationsRouter.get('/:id', controller.getConversation);

/**
 * POST /api/v1/conversations/:id/messages
 * Body: { content: string }
 * → Sends a student message, returns AI reply.
 */
conversationsRouter.post(
  '/:id/messages',
  validate(messageSchema),
  controller.sendMessage,
);

/**
 * POST /api/v1/conversations/:id/submit
 * Body: { submissionToken: string, finalNote?: string }
 * → Summarises the transcript, creates FeedbackSubmission, revokes token.
 */
conversationsRouter.post(
  '/:id/submit',
  validate(submitSchema),
  controller.submitConversation,
);
