import { Router } from 'express';
import { issuesControllerRouter } from './issues.controller';

const router: Router = Router();
router.use('/', issuesControllerRouter);

export { router as issuesRouter };
