import { logger } from './lib/logger';
import './processors/feedback-analysis';
import './processors/document-ingestion';

const startWorker = async () => {
  logger.info('Worker started and listening for jobs...');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down worker gracefully...');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

startWorker().catch((error) => {
  logger.error('Worker failed to start', { error });
  process.exit(1);
});
