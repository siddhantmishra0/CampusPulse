import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { UserRole } from '@campuspulse/shared';
import { CreateUserInput, UpdateUserRolesInput } from './users.schema';

/** Role names that a user may legitimately hold. */
const VALID_ROLES: string[] = Object.values(UserRole);

export class UsersService {
  static async getRoles() {
    return prisma.role.findMany({ orderBy: { name: 'asc' } });
  }

  /** Resolve role names to Role rows, rejecting anything unknown. */
  private static async resolveRoles(roleNames: string[]) {
    const invalid = roleNames.filter((r) => !VALID_ROLES.includes(r as UserRole));
    if (invalid.length > 0) {
      throw Object.assign(new Error(`Unknown role(s): ${invalid.join(', ')}`), { statusCode: 400 });
    }

    const roles = await prisma.role.findMany({ where: { name: { in: roleNames } } });
    const found = roles.map((r) => r.name);
    const missing = roleNames.filter((r) => !found.includes(r));
    if (missing.length > 0) {
      throw Object.assign(
        new Error(`Role(s) not set up in this database: ${missing.join(', ')}. Run the seed first.`),
        { statusCode: 400 }
      );
    }
    return roles;
  }

  static async getUsers(tenantId?: string) {
    return prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(tenantId ? { tenantId } : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        tenantId: true,
        tenant: { select: { id: true, name: true } },
        roles: { select: { role: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async createUser(data: CreateUserInput) {
    const tenant = await prisma.tenant.findUnique({ where: { id: data.tenantId } });
    if (!tenant) {
      throw Object.assign(new Error('Institute not found'), { statusCode: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
    }

    const roles = await UsersService.resolveRoles(data.roles);

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        tenantId: data.tenantId,
        isActive: true,
      },
      select: { id: true, email: true, firstName: true, lastName: true, tenantId: true },
    });

    await prisma.userRoleMapping.createMany({
      data: roles.map((role) => ({ userId: user.id, roleId: role.id })),
    });

    return user;
  }

  /** Replace a user's roles wholesale. */
  static async updateUserRoles(actorId: string, userId: string, data: UpdateUserRolesInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }

    // Guard against an owner removing their own owner role and locking
    // themselves out of the platform.
    if (actorId === userId && !data.roles.includes(UserRole.PLATFORM_OWNER)) {
      throw Object.assign(
        new Error('You cannot remove your own PLATFORM_OWNER role'),
        { statusCode: 400 }
      );
    }

    const roles = await UsersService.resolveRoles(data.roles);

    await prisma.$transaction([
      prisma.userRoleMapping.deleteMany({ where: { userId } }),
      prisma.userRoleMapping.createMany({
        data: roles.map((role) => ({ userId, roleId: role.id })),
      }),
    ]);

    return { userId, roles: roles.map((r) => r.name) };
  }
}