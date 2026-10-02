import { CreateDepartmentSchema, CreateSubjectSchema } from '@campuspulse/shared';
import { z } from 'zod';

export const createDepartmentSchema = z.object({
  body: CreateDepartmentSchema,
});

export const updateDepartmentSchema = z.object({
  body: CreateDepartmentSchema.partial().extend({
    isActive: z.boolean().optional(),
  }),
});

export const createSubjectSchema = z.object({
  body: CreateSubjectSchema,
});

export const updateSubjectSchema = z.object({
  body: CreateSubjectSchema.partial().extend({
    isActive: z.boolean().optional(),
  }),
});
