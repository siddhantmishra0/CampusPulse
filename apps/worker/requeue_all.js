const { Queue } = require('bullmq');
const Redis = require('ioredis');

const redis = new Redis('redis://localhost:6379');

async function requeueAllJobs() {
  const queue = new Queue('feedback-analysis', { connection: redis });
  
  // The original failed submissions
  const submissions = [
    { submissionId: '5db04934-ffa1-4ab5-b5e8-dcc077884232', campaignId: '7b069ace-3fa9-43fc-b521-676e89b2899d' },
    { submissionId: '3525148d-075b-4672-856a-f2466c077323', campaignId: '7b069ace-3fa9-43fc-b521-676e89b2899d' },
    { submissionId: '1777f195-7382-408e-92bb-db88b86e8388', campaignId: 'd79a375e-d560-45a9-be88-0709638c023c' },
    { submissionId: 'd44b08b4-44dc-4f05-8301-13b0f0488c71', campaignId: 'd2e8667e-c458-4ee8-b2bd-77336ad32adf', tenantId: '24691e1a-9d81-47c9-bade-967e44172d53' },
    { submissionId: '83fe7574-8695-47f6-a747-0f20032c92bf', campaignId: '5441e078-edf7-408e-8717-65ee2e4b2c60', tenantId: '24691e1a-9d81-47c9-bade-967e44172d53' },
  ];
  
  for (const s of submissions) {
    await queue.add('analyze-feedback', s);
    console.log(`Added job for submission ${s.submissionId}`);
  }
  
  await queue.close();
  await redis.quit();
}

requeueAllJobs().catch(console.error);