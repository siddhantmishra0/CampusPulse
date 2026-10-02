const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const submissions = await prisma.feedbackSubmission.findMany({
    include: { responses: true }
  });
  console.log(JSON.stringify(submissions, null, 2));
  await prisma.$disconnect();
}
main();