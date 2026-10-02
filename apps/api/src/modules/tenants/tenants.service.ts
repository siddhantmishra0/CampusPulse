import { prisma } from '../../lib/prisma';
import { CreateTenantInput, UpdateTenantInput } from './tenants.schema';

export class TenantsService {
  static async createTenant(data: CreateTenantInput) {
    if (data.domain) {
      const existing = await prisma.tenant.findUnique({
        where: { domain: data.domain },
      });
      if (existing) throw new Error('Domain already in use');
    }

    return prisma.tenant.create({ data });
  }

  static async getTenants() {
    return prisma.tenant.findMany();
  }

  static async getTenantById(id: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
    });
    if (!tenant) throw new Error('Tenant not found');
    return tenant;
  }

  static async updateTenant(id: string, data: UpdateTenantInput) {
    if (data.domain) {
      const existing = await prisma.tenant.findUnique({
        where: { domain: data.domain },
      });
      if (existing && existing.id !== id) {
        throw new Error('Domain already in use');
      }
    }

    return prisma.tenant.update({
      where: { id },
      data,
    });
  }
}
