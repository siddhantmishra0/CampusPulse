import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    tenantId: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    roles: z.array(z.string().min(1)).min(1, 'at least one role is required'),
  }),
});

export const updateUserRolesSchema = z.object({
  body: z.object({
    roles: z.array(z.string().min(1)).min(1, 'at least one role is required'),
  }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>['body'];
export type UpdateUserRolesInput = z.infer<typeof updateUserRolesSchema>['body'];