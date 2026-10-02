import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { env } from '../config/env';

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    requestId: req.id,
    method: req.method,
    url: req.url,
  });

  const statusCode = err.statusCode || 500;
  
  // Don't leak internal server error details in production
  const message = statusCode === 500 && env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
