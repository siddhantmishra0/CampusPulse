import { z } from 'zod';
import { FeedbackAnalysisSchema } from './schemas';

export type FeedbackAnalysis = z.infer<typeof FeedbackAnalysisSchema>;

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
