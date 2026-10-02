const { Queue } = require('bullmq');
const Redis = require('ioredis');

const redis = new Redis('redis://localhost:6379');

async function checkFailedJobs() {
  const queue = new Queue('feedback-analysis', { connection: redis });
  const failed = await queue.getFailed(0, 10);
  
  for (const job of failed) {
    console.log('=== Failed Job:', job.id, '===');
    console.log('Data:', JSON.stringify(job.data, null, 2));
    console.log('Failed Reason:', job.failedReason);
    console.log('Stacktrace:', job.stacktrace);
    console.log('Attempts Made:', job.attemptsMade);
    console.log('Max Attempts:', job.opts.attempts);
    console.log('');
  }
  
  await queue.close();
  await redis.quit();
}

checkFailedJobs().catch(console.error);