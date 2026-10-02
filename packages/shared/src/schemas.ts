import { z } from 'zod';
import { Sentiment } from './enums';

export const FeedbackAnalysisSchema = z.object({
  sentiment: z.nativeEnum(Sentiment),
  topics: z.array(
    z.object({
      name: z.string(),
      confidence: z.number().min(0).max(1),
    })
  ),
  issues: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      category: z.string(),
    })
  ),
  summary: z.string(),
  modelVersion: z.string(),
});

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  isActive: z.boolean(),
  tenantId: z.string().optional(),
});

// Phase 3 Schemas
export const CreateDepartmentSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
});

export const CreateSubjectSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  departmentId: z.string().uuid(),
});

export const CreateCampaignSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  campaignType: z.string(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  departmentId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
  isAnonymous: z.boolean().default(true),
  allowConversational: z.boolean().default(true),
  allowTraditional: z.boolean().default(true),
});

export type CreateDepartmentInput = z.infer<typeof CreateDepartmentSchema>;
export type CreateSubjectInput = z.infer<typeof CreateSubjectSchema>;
export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;

// Phase 4 Schemas — Conversational Feedback
export const StartConversationSchema = z.object({
  submissionToken: z.string().min(1),
});

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const SubmitConversationSchema = z.object({
  // Optional: client can send a final note, otherwise we summarize from transcript
  finalNote: z.string().max(500).optional(),
});

export type StartConversationInput = z.infer<typeof StartConversationSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type SubmitConversationInput = z.infer<typeof SubmitConversationSchema>;

