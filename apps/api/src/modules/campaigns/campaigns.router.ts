import { Router } from 'express';
import { CampaignsController } from './campaigns.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { createCampaignSchema, updateCampaignSchema, transitionCampaignSchema } from './campaigns.schema';
import { UserRole } from '@campuspulse/shared';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize([UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER]),
  validate(createCampaignSchema),
  CampaignsController.createCampaign
);

router.get(
  '/',
  authorize([UserRole.PLATFORM_OWNER, UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER, UserRole.FACULTY]),
  CampaignsController.getCampaigns
);

router.get(
  '/:id',
  authorize([UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER, UserRole.FACULTY, UserRole.STUDENT]),
  CampaignsController.getCampaign
);

router.patch(
  '/:id',
  authorize([UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER]),
  validate(updateCampaignSchema),
  CampaignsController.updateCampaign
);

router.delete(
  '/:id',
  authorize([UserRole.INSTITUTION_ADMIN]),
  CampaignsController.deleteCampaign
);

router.post(
  '/:id/transition',
  authorize([UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER]),
  validate(transitionCampaignSchema),
  CampaignsController.transitionCampaign
);

export const campaignsRouter: Router = router;
