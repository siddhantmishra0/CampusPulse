import { prisma } from '../../lib/prisma';
import { CreateCampaignInput } from '@campuspulse/shared';

export class CampaignsService {
  static async createCampaign(tenantId: string, createdById: string, data: CreateCampaignInput) {
    return prisma.campaign.create({
      data: {
        ...data,
        tenantId,
        createdById,
        status: 'DRAFT',
      },
    });
  }

  static async getCampaigns(tenantId: string, departmentId?: string) {
    return prisma.campaign.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(departmentId ? { departmentId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        department: true,
        subject: true,
        faculty: true,
        _count: {
          select: { feedbackSubmissions: true },
        },
      },
    });
  }

  static async getCampaignById(tenantId: string, id: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        department: true,
        subject: true,
        faculty: true,
        academicYear: true,
        semester: true,
      },
    });
    if (!campaign) throw new Error('Campaign not found');
    return campaign;
  }

  static async updateCampaign(tenantId: string, id: string, data: Partial<CreateCampaignInput>) {
    const campaign = await this.getCampaignById(tenantId, id);
    if (campaign.status !== 'DRAFT') {
      throw new Error('Can only update campaigns in DRAFT status');
    }

    return prisma.campaign.update({
      where: { id },
      data,
    });
  }

  static async deleteCampaign(tenantId: string, id: string) {
    const campaign = await this.getCampaignById(tenantId, id);
    if (campaign.status !== 'DRAFT' && campaign.status !== 'CLOSED' && campaign.status !== 'ARCHIVED') {
      throw new Error('Cannot delete an active campaign');
    }

    return prisma.campaign.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  static async transitionCampaignStatus(tenantId: string, id: string, action: 'schedule' | 'activate' | 'close' | 'archive') {
    const campaign = await this.getCampaignById(tenantId, id);
    let nextStatus = campaign.status;

    switch (action) {
      case 'schedule':
        if (campaign.status !== 'DRAFT') throw new Error('Invalid transition: Can only schedule DRAFT campaigns');
        nextStatus = 'SCHEDULED';
        break;
      case 'activate':
        if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') throw new Error('Invalid transition: Can only activate DRAFT or SCHEDULED campaigns');
        nextStatus = 'ACTIVE';
        break;
      case 'close':
        if (campaign.status !== 'ACTIVE') throw new Error('Invalid transition: Can only close ACTIVE campaigns');
        nextStatus = 'CLOSED';
        break;
      case 'archive':
        if (campaign.status !== 'CLOSED') throw new Error('Invalid transition: Can only archive CLOSED campaigns');
        nextStatus = 'ARCHIVED';
        break;
      default:
        throw new Error('Invalid action');
    }

    return prisma.campaign.update({
      where: { id },
      data: { status: nextStatus },
    });
  }
}
