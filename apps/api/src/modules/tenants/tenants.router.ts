import { Router } from 'express';
import { TenantsController } from './tenants.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { UserRole } from '@campuspulse/shared';
import { createTenantSchema, updateTenantSchema } from './tenants.schema';

const router = Router();

// Only PLATFORM_OWNER can create and list all tenants
router.post(
  '/',
  authenticate,
  authorize([UserRole.PLATFORM_OWNER]),
  validate(createTenantSchema),
  TenantsController.createTenant
);

router.get(
  '/',
  authenticate,
  authorize([UserRole.PLATFORM_OWNER]),
  TenantsController.getTenants
);

// PLATFORM_OWNER or INSTITUTION_ADMIN (for their own tenant) can view/update
router.get(
  '/:id',
  authenticate,
  authorize([UserRole.PLATFORM_OWNER, UserRole.INSTITUTION_ADMIN]),
  TenantsController.getTenantById
);

router.patch(
  '/:id',
  authenticate,
  authorize([UserRole.PLATFORM_OWNER, UserRole.INSTITUTION_ADMIN]),
  validate(updateTenantSchema),
  TenantsController.updateTenant
);

export const tenantsRouter: Router = router;
