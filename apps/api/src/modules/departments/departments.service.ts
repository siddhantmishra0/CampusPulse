import { prisma } from '../../lib/prisma';
import { CreateDepartmentInput, CreateSubjectInput } from '@campuspulse/shared';

export class DepartmentsService {
  static async createDepartment(tenantId: string, data: CreateDepartmentInput) {
    const existing = await prisma.department.findFirst({
      where: { tenantId, code: data.code },
    });
    if (existing) throw new Error('Department code already exists in this tenant');

    return prisma.department.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  static async getDepartments(tenantId: string) {
    return prisma.department.findMany({
      where: { tenantId, deletedAt: null },
      include: { subjects: true },
    });
  }

  static async getDepartmentById(tenantId: string, id: string) {
    const department = await prisma.department.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { subjects: true },
    });
    if (!department) throw new Error('Department not found');
    return department;
  }

  static async updateDepartment(tenantId: string, id: string, data: Partial<CreateDepartmentInput> & { isActive?: boolean }) {
    if (data.code) {
      const existing = await prisma.department.findFirst({
        where: { tenantId, code: data.code },
      });
      if (existing && existing.id !== id) {
        throw new Error('Department code already exists in this tenant');
      }
    }

    const dept = await prisma.department.findFirst({ where: { id, tenantId } });
    if (!dept) throw new Error('Department not found');

    return prisma.department.update({
      where: { id },
      data,
    });
  }

  static async deleteDepartment(tenantId: string, id: string) {
    const dept = await prisma.department.findFirst({ where: { id, tenantId } });
    if (!dept) throw new Error('Department not found');

    return prisma.department.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // --- Subjects ---

  static async createSubject(tenantId: string, data: CreateSubjectInput) {
    // verify department belongs to tenant
    const dept = await prisma.department.findFirst({
      where: { id: data.departmentId, tenantId },
    });
    if (!dept) throw new Error('Department not found or does not belong to tenant');

    return prisma.subject.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  static async getSubjects(tenantId: string, departmentId?: string) {
    return prisma.subject.findMany({
      where: { 
        tenantId,
        ...(departmentId ? { departmentId } : {}),
        deletedAt: null 
      },
      include: { department: true },
    });
  }
}
