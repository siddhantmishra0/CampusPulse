import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { OpenAIEmbeddings } from '@langchain/openai';
import { env } from '../config/env';

// Use require for pdf-parse to avoid TS call signature issues
const pdfParse = require('pdf-parse');

const prisma = new PrismaClient();
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: env.LLM_API_KEY,
  modelName: 'text-embedding-3-small',
});

export const documentIngestionWorker = new Worker('document-ingestion', async (job: Job) => {
  const { documentId, versionId, fileUrl, tenantId } = job.data;
  logger.info(`Processing document ingestion job ${job.id}`, { documentId, versionId });

  try {
    // 1. Read file
    const ext = path.extname(fileUrl).toLowerCase();
    let text = '';

    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(fileUrl);
      const data = await pdfParse(dataBuffer);
      text = data.text;
    } else {
      text = fs.readFileSync(fileUrl, 'utf-8');
    }

    if (!text.trim()) {
      throw new Error('Document is empty or text extraction failed');
    }

    // 2. Chunk text
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const chunks = await splitter.createDocuments([text]);

    // 3. Generate embeddings & Store
    let pageNumber = 1; // Basic page number approximation
    for (const chunk of chunks) {
      const vector = await embeddings.embedQuery(chunk.pageContent);
      
      // Since prisma doesn't support writing vectors directly via ORM yet, use executeRawUnsafe
      await prisma.$executeRawUnsafe(
        `INSERT INTO document_chunks ("id", "tenantId", "documentVersionId", "chunkText", "embedding", "pageNumber", "metadata", "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, $5, $6::jsonb, NOW())`,
        tenantId,
        versionId,
        chunk.pageContent,
        `[${vector.join(',')}]`,
        pageNumber,
        JSON.stringify(chunk.metadata || {})
      );
      pageNumber++;
    }

    // 4. Update Document status
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'READY' }
    });

    return { success: true, chunksCount: chunks.length };
  } catch (error: any) {
    logger.error(`Document ingestion job ${job.id} failed: ${error.message}`);
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'FAILED' }
    });
    throw error;
  }
}, { connection: redis });

documentIngestionWorker.on('completed', (job) => {
  logger.info(`Document ingestion job ${job.id} completed. Result:`, job.returnvalue);
});

documentIngestionWorker.on('failed', (job, err) => {
  logger.error(`Document ingestion job ${job?.id} failed`, { error: err.message });
});
