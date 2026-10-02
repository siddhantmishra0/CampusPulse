import { Router } from 'express';
import { documentsControllerRouter } from './documents.controller';

const router: Router = Router();
router.use('/', documentsControllerRouter);

export { router as documentsRouter };
