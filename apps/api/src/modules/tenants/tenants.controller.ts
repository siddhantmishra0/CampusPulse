import { Request, Response, NextFunction } from 'express';
import { TenantsService } from './tenants.service';

export class TenantsController {
  static async createTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenant = await TenantsService.createTenant(req.body);
      res.status(201).json({ success: true, data: tenant });
    } catch (error) {
      if (error instanceof Error && error.message === 'Domain already in use') {
        res.status(409).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  }

  static async getTenants(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenants = await TenantsService.getTenants();
      res.status(200).json({ success: true, data: tenants });
    } catch (error) {
      next(error);
    }
  }

  static async getTenantById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const tenant = await TenantsService.getTenantById(id);
      res.status(200).json({ success: true, data: tenant });
    } catch (error) {
      if (error instanceof Error && error.message === 'Tenant not found') {
        res.status(404).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  }

  static async updateTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const tenant = await TenantsService.updateTenant(id, req.body);
      res.status(200).json({ success: true, data: tenant });
    } catch (error) {
      if (error instanceof Error && error.message === 'Domain already in use') {
        res.status(409).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  }
}
