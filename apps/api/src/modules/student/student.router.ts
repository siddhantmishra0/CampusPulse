import { Router } from 'express';
import { StudentController } from './student.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '@campuspulse/shared';

const router = Router();

router.use(authenticate);
router.use(authorize([UserRole.STUDENT]));

router.get('/campaigns', StudentController.getCampaigns);
router.get('/updates', StudentController.getUpdates);

export const studentRouter: Router = router;
