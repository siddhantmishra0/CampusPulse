const { Queue } = require('bullmq');
const Redis = require('ioredis');

const redis = new Redis('redis://localhost:6379');

async function checkQueue() {
  const queue = new Queue('feedback-analysis', { connection: redis });
  const waiting = await queue.getWaiting();
  const active = await queue.getActive();
  const completed = await queue.getCompleted();
  const failed = await queue.getFailed();
  
  console.log('Waiting:', waiting.length);
  console.log('Active:', active.length);
  console.log('Completed:', completed.length);
  console.log('Failed:', failed.length);
  
  for (const job of [...waiting, ...active, ...completed, ...failed]) {
    console.log('Job:', job.id, job.name, job.data);
  }
  await queue.close();
  await redis.quit();
}

checkQueue().catch(console.error);