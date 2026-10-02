const { Queue } = require('bullmq');
const Redis = require('ioredis');

const redis = new Redis('redis://localhost:6379');

async function retryFailedJobs() {
  const queue = new Queue('feedback-analysis', { connection: redis });
  
  // Get failed jobs and retry them
  const failedJobs = await queue.getFailed();
  console.log(`Found ${failedJobs.length} failed jobs`);
  
  for (const job of failedJobs) {
    await job.retry();
    console.log(`Retried job ${job.id}`);
  }
  
  await queue.close();
  await redis.quit();
}

retryFailedJobs().catch(console.error);