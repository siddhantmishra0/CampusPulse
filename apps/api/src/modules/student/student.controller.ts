import { Request, Response, NextFunction } from 'express';
import { StudentService } from './student.service';

export class StudentController {
  static async getCampaigns(req: Request, res: Response, next: NextFunction) {
    try {
      const campaigns = await StudentService.getEligibleCampaigns(req.user!.tenantId!);
      res.json({ data: campaigns });
    } catch (error) {
      next(error);
    }
  }

  static async getUpdates(req: Request, res: Response, next: NextFunction) {
    try {
      const updates = await StudentService.getPublishedUpdates(req.user!.tenantId!);
      res.json({ data: updates });
    } catch (error) {
      next(error);
    }
  }
}
