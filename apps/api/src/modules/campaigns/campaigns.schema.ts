import { z } from 'zod';
import { CreateCampaignSchema } from '@campuspulse/shared';

export const createCampaignSchema = z.object({
  body: CreateCampaignSchema,
});

export const updateCampaignSchema = z.object({
  body: CreateCampaignSchema.partial(),
});

export const transitionCampaignSchema = z.object({
  body: z.object({
    action: z.enum(['schedule', 'activate', 'close', 'archive']),
  }),
});
