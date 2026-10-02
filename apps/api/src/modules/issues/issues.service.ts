import { prisma } from '../../lib/prisma';
import { z } from 'zod';

export const CreateIssueSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  category: z.string().min(1),
  assignedDepartmentId: z.string().uuid().optional(),
  assignedReviewerId: z.string().uuid().optional(),
});

export const UpdateIssueSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  status: z.enum(['IDENTIFIED', 'UNDER_REVIEW', 'ACTION_PLANNED', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED']).optional(),
  assignedDepartmentId: z.string().uuid().nullish(),
  assignedReviewerId: z.string().uuid().nullish(),
});

export const CreateActionSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  ownerId: z.string().uuid().optional(),
  targetDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const UpdateActionSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().min(1).optional(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  ownerId: z.string().uuid().nullish(),
  targetDate: z.string().datetime().nullish(),
  notes: z.string().optional(),
});

export const CreatePublishedUpdateSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
});

export const CreateIssueFromFeedbackSchema = z.object({
  feedbackIssueId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  assignedDepartmentId: z.string().uuid().optional(),
  assignedReviewerId: z.string().uuid().optional(),
});

export class IssuesService {
  static async listIssues(
    tenantId: string,
    filters: { status?: string; category?: string; departmentId?: string },
  ) {
    return prisma.issue.findMany({
      where: {
        tenantId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.departmentId ? { assignedDepartmentId: filters.departmentId } : {}),
      },
      include: {
        assignedDepartment: { select: { id: true, name: true } },
        assignedReviewer: { select: { id: true, firstName: true, lastName: true } },
        actions: {
          include: { publishedUpdates: { orderBy: { publishedAt: 'desc' }, take: 1 } },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { actions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getIssueById(tenantId: string, id: string) {
    return prisma.issue.findFirst({
      where: { id, tenantId },
      include: {
        assignedDepartment: { select: { id: true, name: true } },
        assignedReviewer: { select: { id: true, firstName: true, lastName: true } },
        sourceCampaigns: { select: { id: true, title: true } },
        actions: {
          include: {
            owner: { select: { id: true, firstName: true, lastName: true } },
            publishedUpdates: { orderBy: { publishedAt: 'desc' } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  static async createIssue(tenantId: string, data: z.infer<typeof CreateIssueSchema>) {
    return prisma.issue.create({
      data: { tenantId, ...data },
    });
  }

  static async createIssueFromFeedback(tenantId: string, data: z.infer<typeof CreateIssueFromFeedbackSchema>) {
    // Get the feedback issue with its analysis and submission
    const feedbackIssue = await prisma.feedbackIssue.findFirst({
      where: { id: data.feedbackIssueId },
      include: {
        analysis: {
          include: {
            submission: {
              include: { campaign: true },
            },
          },
        },
      },
    });

    if (!feedbackIssue) {
      throw new Error('Feedback issue not found');
    }

    // Verify tenant access
    if (feedbackIssue.analysis.submission.campaign.tenantId !== tenantId) {
      throw new Error('Access denied');
    }

    // Check if already promoted
    const existing = await prisma.issue.findFirst({
      where: {
        tenantId,
        description: { contains: feedbackIssue.id },
      },
    });

    if (existing) {
      throw new Error('This feedback issue has already been promoted to a tracking issue');
    }

    // Create the tracking issue
    return prisma.issue.create({
      data: {
        tenantId,
        title: feedbackIssue.title,
        description: `${feedbackIssue.description}\n\n---\nPromoted from AI-detected feedback issue: ${feedbackIssue.id}`,
        category: feedbackIssue.category,
        assignedDepartmentId: data.assignedDepartmentId,
        assignedReviewerId: data.assignedReviewerId,
        status: 'IDENTIFIED',
        sourceCampaigns: data.campaignId ? { connect: { id: data.campaignId } } : 
          (feedbackIssue.analysis.submission.campaignId ? { connect: { id: feedbackIssue.analysis.submission.campaignId } } : undefined),
      },
      include: {
        assignedDepartment: { select: { id: true, name: true } },
        assignedReviewer: { select: { id: true, firstName: true, lastName: true } },
        sourceCampaigns: { select: { id: true, title: true } },
      },
    });
  }

  static async listFeedbackIssues(tenantId: string, campaignId?: string) {
    const where: any = {
      analysis: {
        submission: {
          campaign: { tenantId },
        },
      },
    };

    if (campaignId) {
      where.analysis.submission.campaignId = campaignId;
    }

    return prisma.feedbackIssue.findMany({
      where,
      include: {
        analysis: {
          include: {
            submission: {
              include: {
                campaign: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async updateIssue(tenantId: string, id: string, data: z.infer<typeof UpdateIssueSchema>) {
    return prisma.issue.update({
      where: { id, tenantId },
      data,
    });
  }

  static async deleteIssue(tenantId: string, id: string) {
    return prisma.issue.update({
      where: { id, tenantId },
      data: { status: 'ARCHIVED' },
    });
  }

  static async createAction(issueId: string, tenantId: string, data: z.infer<typeof CreateActionSchema>) {
    // Verify issue belongs to tenant
    const issue = await prisma.issue.findFirst({ where: { id: issueId, tenantId } });
    if (!issue) throw new Error('Issue not found');
    return prisma.improvementAction.create({
      data: {
        issueId,
        title: data.title,
        description: data.description,
        ownerId: data.ownerId,
        targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
        notes: data.notes,
      },
    });
  }

  static async updateAction(issueId: string, actionId: string, tenantId: string, data: z.infer<typeof UpdateActionSchema>) {
    const action = await prisma.improvementAction.findFirst({
      where: { id: actionId, issueId, issue: { tenantId } },
    });
    if (!action) throw new Error('Action not found');
    return prisma.improvementAction.update({
      where: { id: actionId },
      data: {
        ...data,
        targetDate: data.targetDate === null ? null : data.targetDate ? new Date(data.targetDate) : undefined,
      },
    });
  }

  static async createPublishedUpdate(
    issueId: string,
    actionId: string,
    tenantId: string,
    data: z.infer<typeof CreatePublishedUpdateSchema>,
  ) {
    const action = await prisma.improvementAction.findFirst({
      where: { id: actionId, issueId, issue: { tenantId } },
    });
    if (!action) throw new Error('Action not found');
    return prisma.publishedUpdate.create({
      data: { tenantId, improvementActionId: actionId, ...data },
    });
  }
}
