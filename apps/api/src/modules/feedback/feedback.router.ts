import { Router } from 'express';
import { FeedbackController } from './feedback.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { authorizeSubmissionSchema, submitFeedbackSchema } from './feedback.schema';
import { UserRole } from '@campuspulse/shared';

const router = Router();

router.use(authenticate);

// Step 1: Student requests a one-time submission token after eligibility check
router.post(
  '/authorize',
  authorize([UserRole.STUDENT]),
  validate(authorizeSubmissionSchema),
  FeedbackController.authorizeSubmission
);

// Step 2: Student submits feedback using the one-time token
router.post(
  '/',
  authorize([UserRole.STUDENT]),
  validate(submitFeedbackSchema),
  FeedbackController.submitFeedback
);

// Check analysis status for a submission
router.get(
  '/:id/status',
  authorize([UserRole.STUDENT, UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER]),
  FeedbackController.getSubmissionStatus
);

export const feedbackRouter: Router = router;
