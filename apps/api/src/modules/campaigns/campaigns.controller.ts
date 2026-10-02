import { Request, Response, NextFunction } from 'express';
import { CampaignsService } from './campaigns.service';

export class CampaignsController {
  static async createCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      const campaign = await CampaignsService.createCampaign(req.user!.tenantId!, req.user!.id, req.body);
      res.status(201).json({ data: campaign });
    } catch (error) {
      next(error);
    }
  }

  static async getCampaigns(req: Request, res: Response, next: NextFunction) {
    try {
      const departmentId = req.query['departmentId'] as string | undefined;
      const campaigns = await CampaignsService.getCampaigns(req.user!.tenantId!, departmentId);
      res.json({ data: campaigns });
    } catch (error) {
      next(error);
    }
  }

  static async getCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params['id'] as string;
      const campaign = await CampaignsService.getCampaignById(req.user!.tenantId!, id);
      res.json({ data: campaign });
    } catch (error) {
      next(error);
    }
  }

  static async updateCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params['id'] as string;
      const campaign = await CampaignsService.updateCampaign(req.user!.tenantId!, id, req.body);
      res.json({ data: campaign });
    } catch (error) {
      next(error);
    }
  }

  static async deleteCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params['id'] as string;
      await CampaignsService.deleteCampaign(req.user!.tenantId!, id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async transitionCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params['id'] as string;
      const campaign = await CampaignsService.transitionCampaignStatus(req.user!.tenantId!, id, req.body.action);
      res.json({ data: campaign });
    } catch (error) {
      next(error);
    }
  }
}
