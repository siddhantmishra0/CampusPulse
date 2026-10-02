import { Router } from 'express';
import { analyticsControllerRouter } from './analytics.controller';

const router: Router = Router();
router.use('/', analyticsControllerRouter);

export { router as analyticsRouter };
