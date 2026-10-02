import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { requestId } from './middleware/requestId';
import { apiLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';

import { healthRouter } from './modules/health/health.router';
import { authRouter } from './modules/auth/auth.router';
import { tenantsRouter } from './modules/tenants/tenants.router';
import { usersRouter } from './modules/users/users.router';
import { departmentsRouter } from './modules/departments/departments.router';
import { campaignsRouter } from './modules/campaigns/campaigns.router';
import { feedbackRouter } from './modules/feedback/feedback.router';
import { studentRouter } from './modules/student/student.router';
import { analyticsRouter } from './modules/analytics/analytics.router';
import { documentsRouter } from './modules/documents/documents.router';
import { issuesRouter } from './modules/issues/issues.router';
import { conversationsRouter } from './modules/conversations/conversations.router';

export const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));

// Parsers
app.use(express.json());
app.use(cookieParser());

// Custom middleware
app.use(requestId);
app.use(apiLimiter);

// Routes
app.use('/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/tenants', tenantsRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/departments', departmentsRouter);
app.use('/api/v1/campaigns', campaignsRouter);
app.use('/api/v1/feedback', feedbackRouter);
app.use('/api/v1/student', studentRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/documents', documentsRouter);
app.use('/api/v1/issues', issuesRouter);
app.use('/api/v1/conversations', conversationsRouter);

// Error handling
app.use(errorHandler);
