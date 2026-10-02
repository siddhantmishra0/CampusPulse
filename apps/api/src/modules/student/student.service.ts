import { prisma } from '../../lib/prisma';

export class StudentService {
  /**
   * Returns ACTIVE campaigns eligible for the current student.
   * For now, all active campaigns in the tenant are returned.
   * Eligibility filtering (by enrollment/department) can be layered on here.
   */
  static async getEligibleCampaigns(tenantId: string) {
    const now = new Date();
    return prisma.campaign.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        deletedAt: null,
        startAt: { lte: now },
        endAt: { gte: now },
      },
      orderBy: { endAt: 'asc' },
      include: {
        department: true,
        subject: true,
        faculty: true,
      },
    });
  }

  /**
   * Returns published institutional updates visible to students in the tenant.
   */
  static async getPublishedUpdates(tenantId: string) {
    return prisma.publishedUpdate.findMany({
      where: { tenantId },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    });
  }
}
