import { Router } from 'express';
import { DepartmentsController } from './departments.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { createDepartmentSchema, updateDepartmentSchema, createSubjectSchema } from './departments.schema';
import { UserRole } from '@campuspulse/shared';

const router = Router();

router.use(authenticate);

// Subjects (placed before /:id to avoid matching issues, though they could be separated into a subjects.router.ts)
router.post(
  '/subjects',
  authorize([UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER]),
  validate(createSubjectSchema),
  DepartmentsController.createSubject
);

router.get(
  '/subjects',
  authorize([UserRole.PLATFORM_OWNER, UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER, UserRole.FACULTY]),
  DepartmentsController.getSubjects
);

// Departments
router.post(
  '/',
  authorize([UserRole.INSTITUTION_ADMIN]),
  validate(createDepartmentSchema),
  DepartmentsController.createDepartment
);

router.get(
  '/',
  authorize([UserRole.PLATFORM_OWNER, UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER, UserRole.FACULTY]),
  DepartmentsController.getDepartments
);

router.get(
  '/:id',
  authorize([UserRole.PLATFORM_OWNER, UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER, UserRole.FACULTY]),
  DepartmentsController.getDepartment
);

router.patch(
  '/:id',
  authorize([UserRole.INSTITUTION_ADMIN]),
  validate(updateDepartmentSchema),
  DepartmentsController.updateDepartment
);

router.delete(
  '/:id',
  authorize([UserRole.INSTITUTION_ADMIN]),
  DepartmentsController.deleteDepartment
);

export const departmentsRouter: Router = router;
