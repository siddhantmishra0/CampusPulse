import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { UserRole } from '@campuspulse/shared';
import {
  getSentimentSummary,
  getTopTopics,
  getIssueSummary,
  getOverallSummary,
  exportAnalytics,
} from '../../lib/analytics';

const router: express.Router = express.Router();

/** Safely extract a single string value from Express query params */
const qs = (val: unknown): string | undefined =>
  typeof val === 'string' ? val : undefined;


// Apply auth to every route in this router
router.use(authenticate);
router.use(authorize([UserRole.PLATFORM_OWNER, UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER, UserRole.FACULTY]));

// Validation schemas
const CampaignParamsSchema = z.object({
  params: z.object({ campaignId: z.string().uuid() }),
  body: z.object({}).optional(),
  query: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
      limit: z.string().optional(),
      format: z.enum(['csv', 'json']).optional(),
    })
    .optional(),
});

router.get(
  '/:campaignId/sentiment',
  validate(CampaignParamsSchema),
  async (req: Request, res: Response) => {
    try {
      const campaignId = req.params.campaignId as string;
      const start = qs(req.query.start);
      const end = qs(req.query.end);
      const data = await getSentimentSummary(campaignId, start, end);
      res.json({ success: true, data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: 'Failed to fetch sentiment summary' });
    }
  },
);

router.get(
  '/:campaignId/topics',
  validate(CampaignParamsSchema),
  async (req: Request, res: Response) => {
    try {
      const campaignId = req.params.campaignId as string;
      const start = qs(req.query.start);
      const end = qs(req.query.end);
      const limitStr = qs(req.query.limit);
      const data = await getTopTopics(campaignId, limitStr ? Number(limitStr) : 10, start, end);
      res.json({ success: true, data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: 'Failed to fetch top topics' });
    }
  },
);

router.get(
  '/:campaignId/issues',
  validate(CampaignParamsSchema),
  async (req: Request, res: Response) => {
    try {
      const campaignId = req.params.campaignId as string;
      const start = qs(req.query.start);
      const end = qs(req.query.end);
      const data = await getIssueSummary(campaignId, start, end);
      res.json({ success: true, data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: 'Failed to fetch issue summary' });
    }
  },
);

router.get(
  '/:campaignId/summary',
  validate(CampaignParamsSchema),
  async (req: Request, res: Response) => {
    try {
      const campaignId = req.params.campaignId as string;
      const start = qs(req.query.start);
      const end = qs(req.query.end);
      const data = await getOverallSummary(campaignId, start, end);
      res.json({ success: true, data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: 'Failed to fetch overall summary' });
    }
  },
);

router.get(
  '/:campaignId/export',
  validate(CampaignParamsSchema),
  async (req: Request, res: Response) => {
    try {
      const campaignId = req.params.campaignId as string;
      const start = qs(req.query.start);
      const end = qs(req.query.end);
      const format = (qs(req.query.format) ?? 'json') as 'csv' | 'json';
      const data = await exportAnalytics(campaignId, format, start, end);
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-${campaignId}.csv"`);
        res.send(data);
        return;
      }
      res.json({ success: true, data: JSON.parse(data as string) });
      return;
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: 'Failed to export analytics' });
    }
  },
);

export { router as analyticsControllerRouter };
