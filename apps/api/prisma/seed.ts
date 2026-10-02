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

  // Departments (and a starter subject per department) for the demo tenant.
  // The campaign "Target Department" selector reads from GET /departments, so a
  // fresh database needs these rows or that dropdown is empty.
  console.log('Seeding departments...');
  const departments = [
    { code: 'CE', name: 'Computer Engineering', subjects: [
      { code: 'CS301', name: 'Data Structures and Algorithms' },
      { code: 'CS302', name: 'Database Management Systems' },
      { code: 'CS303', name: 'Operating Systems' },
      { code: 'CS304', name: 'Compiler Design' },
    ]},
    { code: 'IT', name: 'Information Technology', subjects: [
      { code: 'IT301', name: 'Web Technologies' },
      { code: 'IT302', name: 'Software Engineering' },
      { code: 'IT303', name: 'Cloud Computing' },
    ]},
    { code: 'ECS', name: 'Electronics & Computer Science', subjects: [
      { code: 'EC301', name: 'Digital Signal Processing' },
      { code: 'EC302', name: 'Microprocessors and Microcontrollers' },
    ]},
    { code: 'ETE', name: 'Electronics and Telecommunication Engineering', subjects: [
      { code: 'ET301', name: 'Communication Systems' },
      { code: 'ET302', name: 'VLSI Design' },
      { code: 'ET303', name: 'Wireless Communication' },
    ]},
    { code: 'AIML', name: 'Artificial Intelligence & Machine Learning', subjects: [
      { code: 'AI301', name: 'Machine Learning' },
      { code: 'AI302', name: 'Deep Learning' },
      { code: 'AI303', name: 'Natural Language Processing' },
    ]},
    { code: 'AIDS', name: 'Artificial Intelligence & Data Science', subjects: [
      { code: 'DS301', name: 'Data Mining' },
      { code: 'DS302', name: 'Big Data Analytics' },
      { code: 'DS303', name: 'Statistical Machine Learning' },
    ]},
    { code: 'IOT', name: 'Internet of Things', subjects: [
      { code: 'IoT301', name: 'IoT Architecture and Protocols' },
      { code: 'IoT302', name: 'Embedded Systems' },
    ]},
    { code: 'CYBER', name: 'Computer Science and Engineering (Cyber Security)', subjects: [
      { code: 'CY301', name: 'Cryptography' },
      { code: 'CY302', name: 'Network Security' },
      { code: 'CY303', name: 'Ethical Hacking' },
    ]},
    { code: 'MEAM', name: 'Mechanical and Mechatronics Engineering (Additive Manufacturing)', subjects: [
      { code: 'ME301', name: 'Additive Manufacturing Processes' },
      { code: 'ME302', name: 'Mechatronics System Design' },
    ]},
    { code: 'ME', name: 'Mechanical Engineering', subjects: [
      { code: 'ME401', name: 'Thermodynamics' },
      { code: 'ME402', name: 'Machine Design' },
      { code: 'ME403', name: 'Fluid Mechanics' },
    ]},
    { code: 'CIVIL', name: 'Civil Engineering', subjects: [
      { code: 'CV301', name: 'Structural Analysis' },
      { code: 'CV302', name: 'Geotechnical Engineering' },
      { code: 'CV303', name: 'Transportation Engineering' },
    ]},
  ];

  for (const dept of departments) {
    // Department has no unique constraint on (tenantId, code), so upsert by hand.
    const existing = await prisma.department.findFirst({
      where: { tenantId: tenant.id, code: dept.code },
    });

    const department = existing
      ? await prisma.department.update({ where: { id: existing.id }, data: { name: dept.name, isActive: true } })
      : await prisma.department.create({
          data: { tenantId: tenant.id, code: dept.code, name: dept.name, isActive: true },
        });

    for (const subject of dept.subjects) {
      const existingSubject = await prisma.subject.findFirst({
        where: { tenantId: tenant.id, code: subject.code },
      });
      if (existingSubject) {
        await prisma.subject.update({
          where: { id: existingSubject.id },
          data: { name: subject.name, departmentId: department.id, isActive: true },
        });
      } else {
        await prisma.subject.create({
          data: { tenantId: tenant.id, departmentId: department.id, code: subject.code, name: subject.name, isActive: true },
        });
      }
    }

    console.log(`  ✓ ${dept.code} — ${dept.name} (${dept.subjects.length} subject(s))`);
  }

  console.log(`Seeded ${departments.length} departments.`);

  // Remove previously-seeded departments that are no longer in the list.
  // Departments referenced by campaigns/issues/documents are left alone so the
  // foreign keys stay intact.
  const seededCodes = departments.map((d) => d.code);
  const stale = await prisma.department.findMany({
    where: { tenantId: tenant.id, code: { notIn: seededCodes } },
    include: { _count: { select: { campaigns: true, issues: true, documents: true } } },
  });

  for (const dept of stale) {
    // If a seeded department already carries this name (e.g. a renamed code),
    // repoint everything to it and drop the duplicate so the campaign
    // "Target Department" selector does not list the same name twice.
    const replacement = await prisma.department.findFirst({
      where: { tenantId: tenant.id, name: dept.name },
    });

    if (replacement) {
      const [campaigns, issues, documents] = await prisma.$transaction([
        prisma.campaign.updateMany({ where: { departmentId: dept.id }, data: { departmentId: replacement.id } }),
        prisma.issue.updateMany({ where: { assignedDepartmentId: dept.id }, data: { assignedDepartmentId: replacement.id } }),
        prisma.document.updateMany({ where: { departmentId: dept.id }, data: { departmentId: replacement.id } }),
      ]);
      await prisma.subject.updateMany({ where: { departmentId: dept.id }, data: { departmentId: replacement.id } });
      await prisma.department.delete({ where: { id: dept.id } });
      console.log(`  ✗ merged stale "${dept.name}" into existing department (${campaigns.count} campaign(s), ${issues.count} issue(s), ${documents.count} document(s) repointed)`);
      continue;
    }

    const used = dept._count.campaigns + dept._count.issues + dept._count.documents;
    if (used > 0) {
      console.log(`  ⚠ kept stale "${dept.name}" — referenced by ${dept._count.campaigns} campaign(s), ${dept._count.issues} issue(s), ${dept._count.documents} document(s)`);
      continue;
    }

    // Subject has no cascade from Department, so drop the department's subjects
    // first — but only the ones nothing else points at.
    const subjects = await prisma.subject.findMany({
      where: { departmentId: dept.id },
      include: { _count: { select: { campaigns: true, faculty: true, studentEnrollments: true } } },
    });

    let blocked = 0;
    for (const subject of subjects) {
      const refs = subject._count.campaigns + subject._count.faculty + subject._count.studentEnrollments;
      if (refs > 0) {
        blocked++;
        continue;
      }
      await prisma.subject.delete({ where: { id: subject.id } });
    }

    if (blocked > 0) {
      console.log(`  ⚠ kept stale "${dept.name}" — ${blocked} subject(s) still referenced`);
      continue;
    }

    await prisma.department.delete({ where: { id: dept.id } });
    console.log(`  ✗ removed stale "${dept.name}" (+${subjects.length} subject(s))`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
