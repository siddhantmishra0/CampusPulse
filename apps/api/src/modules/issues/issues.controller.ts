import express, { Request, Response } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { z } from 'zod';
import { UserRole } from '@campuspulse/shared';
import {
  IssuesService,
  CreateIssueSchema,
  UpdateIssueSchema,
  CreateActionSchema,
  UpdateActionSchema,
  CreatePublishedUpdateSchema,
  CreateIssueFromFeedbackSchema,
} from './issues.service';

const router: express.Router = express.Router();

// All routes require auth; STUDENT can only read
router.use(authenticate);

const adminRoles = [UserRole.PLATFORM_OWNER, UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER];

// ─── AI-Detected Feedback Issues (Analytics) ────────────────────────────────

/** GET /api/v1/issues/feedback-issues */
router.get('/feedback-issues', authorize([...adminRoles, UserRole.FACULTY]), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const campaignId = req.query.campaignId as string | undefined;
    const data = await IssuesService.listFeedbackIssues(tenantId, campaignId);
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch feedback issues' });
  }
});

/** POST /api/v1/issues/from-feedback - Promote AI-detected issue to tracking issue */
router.post('/from-feedback', authorize(adminRoles), validate(z.object({ body: CreateIssueFromFeedbackSchema })), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await IssuesService.createIssueFromFeedback(req.user!.tenantId!, req.body);
    res.status(201).json({ success: true, data });
  } catch (err: any) {
    console.error(err);
    if (err.message === 'Feedback issue not found' || err.message === 'Access denied') {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    if (err.message === 'This feedback issue has already been promoted to a tracking issue') {
      res.status(409).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to promote feedback issue' });
  }
});

// ─── Issues ────────────────────────────────────────────────────────────────

/** GET /api/v1/issues */
router.get('/', authorize([...adminRoles, UserRole.FACULTY]), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const { status, category, departmentId } = req.query as Record<string, string | undefined>;
    const data = await IssuesService.listIssues(tenantId, { status, category, departmentId });
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch issues' });
  }
});

/** GET /api/v1/issues/:id */
router.get('/:id', authorize([...adminRoles, UserRole.FACULTY, UserRole.STUDENT]), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId!;
    const id = req.params['id'] as string;
    const data = await IssuesService.getIssueById(tenantId, id);
    if (!data) {
      res.status(404).json({ success: false, error: 'Issue not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch issue' });
  }
});

/** POST /api/v1/issues */
router.post('/', authorize(adminRoles), async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = CreateIssueSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }
    const data = await IssuesService.createIssue(req.user!.tenantId!, parsed.data);
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to create issue' });
  }
});

/** PATCH /api/v1/issues/:id */
router.patch('/:id', authorize(adminRoles), async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = UpdateIssueSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }
    const id = req.params['id'] as string;
    const data = await IssuesService.updateIssue(req.user!.tenantId!, id, parsed.data);
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update issue' });
  }
});

/** DELETE /api/v1/issues/:id (archives) */
router.delete('/:id', authorize(adminRoles), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    await IssuesService.deleteIssue(req.user!.tenantId!, id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to archive issue' });
  }
});

// ─── Improvement Actions ────────────────────────────────────────────────────

/** POST /api/v1/issues/:issueId/actions */
router.post('/:issueId/actions', authorize(adminRoles), async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = CreateActionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }
    const issueId = req.params['issueId'] as string;
    const data = await IssuesService.createAction(issueId, req.user!.tenantId!, parsed.data);
    res.status(201).json({ success: true, data });
  } catch (err: any) {
    console.error(err);
    if (err.message === 'Issue not found') {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to create action' });
  }
});

/** PATCH /api/v1/issues/:issueId/actions/:actionId */
router.patch('/:issueId/actions/:actionId', authorize(adminRoles), async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = UpdateActionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }
    const issueId = req.params['issueId'] as string;
    const actionId = req.params['actionId'] as string;
    const data = await IssuesService.updateAction(issueId, actionId, req.user!.tenantId!, parsed.data);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error(err);
    if (err.message === 'Action not found') {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to update action' });
  }
});

// ─── Published Updates ──────────────────────────────────────────────────────

/** POST /api/v1/issues/:issueId/actions/:actionId/updates */
router.post('/:issueId/actions/:actionId/updates', authorize(adminRoles), async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = CreatePublishedUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }
    const issueId = req.params['issueId'] as string;
    const actionId = req.params['actionId'] as string;
    const data = await IssuesService.createPublishedUpdate(issueId, actionId, req.user!.tenantId!, parsed.data);
    res.status(201).json({ success: true, data });
  } catch (err: any) {
    console.error(err);
    if (err.message === 'Action not found') {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to publish update' });
  }
});

export { router as issuesControllerRouter };
