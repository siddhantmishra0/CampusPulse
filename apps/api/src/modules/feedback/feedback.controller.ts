import { Request, Response, NextFunction } from 'express';
import { FeedbackService } from './feedback.service';

export class FeedbackController {
  static async authorizeSubmission(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await FeedbackService.authorizeSubmission(
        req.user!.tenantId!,
        req.user!.id,
        req.body.campaignId
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  static async submitFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const submission = await FeedbackService.submitFeedback(req.user!.tenantId!, req.body);
      res.status(201).json({ data: submission });
    } catch (error) {
      next(error);
    }
  }

  static async getSubmissionStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params['id'] as string;
      const status = await FeedbackService.getSubmissionStatus(req.user!.tenantId!, id);
      res.json({ data: status });
    } catch (error) {
      next(error);
    }
  }
}
