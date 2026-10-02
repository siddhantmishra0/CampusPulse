import { PrismaClient } from '@prisma/client';
import { UserRole } from '@campuspulse/shared';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Password123!';

async function main() {
  console.log('Seeding roles...');

  const roles = [
    { name: UserRole.PLATFORM_OWNER, description: 'Platform operator' },
    { name: UserRole.INSTITUTION_ADMIN, description: 'Administrator for a single institution' },
    { name: UserRole.DEPARTMENT_REVIEWER, description: 'Reviewer for department issues' },
    { name: UserRole.FACULTY, description: 'Faculty member' },
    { name: UserRole.STUDENT, description: 'Student' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  console.log('Roles seeded successfully.');

  // Create a demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { domain: 'demo.campuspulse.local' },
    update: {},
    create: {
      name: 'Demo University',
      domain: 'demo.campuspulse.local',
      isActive: true,
    },
  });

  console.log('Seeding demo users...');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const demoUsers = [
    { email: 'owner@demo.edu', firstName: 'Platform', lastName: 'Owner', role: UserRole.PLATFORM_OWNER },
    { email: 'admin@demo.edu', firstName: 'Institution', lastName: 'Admin', role: UserRole.INSTITUTION_ADMIN },
    { email: 'reviewer@demo.edu', firstName: 'Department', lastName: 'Reviewer', role: UserRole.DEPARTMENT_REVIEWER },
    { email: 'faculty@demo.edu', firstName: 'Dr. Faculty', lastName: 'Member', role: UserRole.FACULTY },
    { email: 'student@demo.edu', firstName: 'Student', lastName: 'User', role: UserRole.STUDENT },
  ];

  for (const demoUser of demoUsers) {
    const roleRecord = await prisma.role.findUniqueOrThrow({ where: { name: demoUser.role } });

    const user = await prisma.user.upsert({
      where: { email: demoUser.email },
      update: {},
      create: {
        email: demoUser.email,
        firstName: demoUser.firstName,
        lastName: demoUser.lastName,
        passwordHash,
        tenantId: tenant.id,
        isActive: true,
      },
    });

    await prisma.userRoleMapping.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleRecord.id } },
      update: {},
      create: { userId: user.id, roleId: roleRecord.id },
    });

    console.log(`  ✓ ${demoUser.role}: ${demoUser.email}`);
  }

  console.log(`\nAll demo users created! Password for all: "${DEMO_PASSWORD}"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
