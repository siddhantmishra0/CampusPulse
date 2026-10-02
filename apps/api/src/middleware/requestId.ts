import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const reqId = req.headers['x-request-id'] || randomUUID();
  req.id = reqId as string;
  res.setHeader('X-Request-ID', reqId);
  next();
};

// Add `id` to Express Request type
declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: {
        id: string;
        tenantId?: string;
        roles: string[];
      };
      resolvedTenantId?: string;
    }
  }
}
