const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const campaign = await prisma.campaign.findUnique({
    where: { id: '5441e078-edf7-408e-8717-65ee2e4b2c60' }
  });
  console.log(JSON.stringify(campaign, null, 2));
  await prisma.$disconnect();
}
main();