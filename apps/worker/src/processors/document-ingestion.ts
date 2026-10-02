import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { embedText, isEmbeddingsConfigured, toPgVector } from '../lib/embeddings';

// pdf-parse v2 is a rewrite that exposes a PDFParse class instead of a
// callable parser function. Use require to avoid the ESM/CJS typing mismatch.
const { PDFParse } = require('pdf-parse');

const prisma = new PrismaClient();

type ExtractedPage = { num: number; text: string };

/** Extracts per-page text from a PDF using the pdf-parse v2 API. */
async function extractPdfPages(fileUrl: string): Promise<ExtractedPage[]> {
  const data = fs.readFileSync(fileUrl);
  const parser = new PDFParse({ data: new Uint8Array(data) });
  try {
    const result = await parser.getText();
    return result.pages;
  } finally {
    await parser.destroy();
  }
}

export const documentIngestionWorker = new Worker('document-ingestion', async (job: Job) => {
  const { documentId, versionId, fileUrl, tenantId } = job.data;
  logger.info(`Processing document ingestion job ${job.id}`, { documentId, versionId });

  try {
    if (!isEmbeddingsConfigured()) {
      throw new Error('GEMINI_API_KEY is not configured; cannot generate document embeddings');
    }

    // 1. Read file
    const ext = path.extname(fileUrl).toLowerCase();
    let pages: ExtractedPage[];

    if (ext === '.pdf') {
      pages = (await extractPdfPages(fileUrl)).filter((p) => p.text.trim().length > 0);
    } else {
      pages = [{ num: 1, text: fs.readFileSync(fileUrl, 'utf-8') }];
    }

    if (pages.length === 0 || pages.every((p) => !p.text.trim())) {
      throw new Error('Document is empty or text extraction failed');
    }

    // 2. Chunk each page separately so chunks keep their real page number
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    // Re-ingesting a version replaces its chunks instead of duplicating them
    // when a previous attempt failed part-way through.
    await prisma.$executeRawUnsafe(
      `DELETE FROM document_chunks WHERE "documentVersionId" = $1`,
      versionId
    );

    // 3. Generate embeddings & Store
    let chunksCount = 0;
    for (const page of pages) {
      const chunks = await splitter.createDocuments([page.text]);
      for (const chunk of chunks) {
        const vector = await embedText(chunk.pageContent);

        // Since prisma doesn't support writing vectors directly via ORM yet, use executeRawUnsafe
        await prisma.$executeRawUnsafe(
          `INSERT INTO document_chunks ("id", "tenantId", "documentVersionId", "chunkText", "embedding", "pageNumber", "metadata", "createdAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, $5, $6::jsonb, NOW())`,
          tenantId,
          versionId,
          chunk.pageContent,
          toPgVector(vector),
          page.num,
          JSON.stringify(chunk.metadata || {})
        );
        chunksCount++;
      }
    }

    // 4. Update Document status
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'READY' }
    });

    return { success: true, chunksCount };
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
