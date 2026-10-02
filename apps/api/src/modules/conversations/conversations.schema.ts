import { z } from 'zod';
import {
  StartConversationSchema,
  SendMessageSchema,
  SubmitConversationSchema,
} from '@campuspulse/shared';

// Re-export for convenience within the API module
export {
  StartConversationSchema,
  SendMessageSchema,
  SubmitConversationSchema,
};

// Derived types
export type StartConversationBody = z.infer<typeof StartConversationSchema>;
export type SendMessageBody = z.infer<typeof SendMessageSchema>;
export type SubmitConversationBody = z.infer<typeof SubmitConversationSchema>;
