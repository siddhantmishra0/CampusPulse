import { Request, Response, NextFunction } from 'express';
import { DepartmentsService } from './departments.service';

export class DepartmentsController {
  static async createDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      const department = await DepartmentsService.createDepartment(req.user!.tenantId!, req.body);
      res.status(201).json({ data: department });
    } catch (error) {
      next(error);
    }
  }

  static async getDepartments(req: Request, res: Response, next: NextFunction) {
    try {
      const departments = await DepartmentsService.getDepartments(req.user!.tenantId!);
      res.json({ data: departments });
    } catch (error) {
      next(error);
    }
  }

  static async getDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params['id'] as string;
      const department = await DepartmentsService.getDepartmentById(req.user!.tenantId!, id);
      res.json({ data: department });
    } catch (error) {
      next(error);
    }
  }

  static async updateDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params['id'] as string;
      const department = await DepartmentsService.updateDepartment(req.user!.tenantId!, id, req.body);
      res.json({ data: department });
    } catch (error) {
      next(error);
    }
  }

  static async deleteDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params['id'] as string;
      await DepartmentsService.deleteDepartment(req.user!.tenantId!, id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async createSubject(req: Request, res: Response, next: NextFunction) {
    try {
      const subject = await DepartmentsService.createSubject(req.user!.tenantId!, req.body);
      res.status(201).json({ data: subject });
    } catch (error) {
      next(error);
    }
  }

  static async getSubjects(req: Request, res: Response, next: NextFunction) {
    try {
      const departmentId = req.query['departmentId'] as string | undefined;
      const subjects = await DepartmentsService.getSubjects(req.user!.tenantId!, departmentId);
      res.json({ data: subjects });
    } catch (error) {
      next(error);
    }
  }
}
