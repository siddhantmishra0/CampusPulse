import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { UserRole } from '@campuspulse/shared';
import { RegisterInput, LoginInput } from './auth.schema';

export class AuthService {
  static async register(data: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        tenantId: data.tenantId,
      },
    });

    // Default to STUDENT role for self-service registration if tenantId is provided
    if (data.tenantId) {
      const studentRole = await prisma.role.findUnique({
        where: { name: UserRole.STUDENT },
      });

      if (studentRole) {
        await prisma.userRoleMapping.create({
          data: {
            userId: user.id,
            roleId: studentRole.id,
          },
        });
      }
    }

    return { id: user.id, email: user.email };
  }

  static async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new Error('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);

    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    const roles = user.roles.map((r: { role: { name: string } }) => r.role.name);

    const accessToken = jwt.sign(
      { userId: user.id, tenantId: user.tenantId, roles },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.NODE_ENV === 'production' ? '15m' : '1d' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    return { user: { id: user.id, email: user.email, roles, tenantId: user.tenantId }, accessToken, refreshToken };
  }
}
