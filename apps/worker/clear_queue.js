const { Queue } = require('bullmq');
const Redis = require('ioredis');

const redis = new Redis('redis://localhost:6379');

async function clearFailedJobs() {
  const queue = new Queue('feedback-analysis', { connection: redis });
  await queue.obliterate({ force: true });
  console.log('Queue obliterated');
  await queue.close();
  await redis.quit();
}

clearFailedJobs().catch(console.error);