import { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service';

export class UsersController {
  static async getRoles(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ data: await UsersService.getRoles() });
    } catch (error) {
      next(error);
    }
  }

  static async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.query['tenantId'] as string | undefined;
      res.json({ data: await UsersService.getUsers(tenantId) });
    } catch (error) {
      next(error);
    }
  }

  static async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await UsersService.createUser(req.body);
      res.status(201).json({ data: user });
    } catch (error) {
      next(error);
    }
  }

  static async updateUserRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const result = await UsersService.updateUserRoles(req.user!.id, id, req.body);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}