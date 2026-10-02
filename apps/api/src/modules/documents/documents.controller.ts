import express, { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { UserRole } from '@campuspulse/shared';
import { prisma } from '../../lib/prisma';
import { documentIngestionQueue } from '../../lib/queue';
import { isEmbeddingsConfigured } from '../../lib/embeddings';
import { answerFromKnowledgeBase, retrieveChunks } from './documents.service';
import { env } from '../../config/env';

const router: express.Router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Setup multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Apply auth to every route
router.use(authenticate);
router.use(authorize([
  UserRole.PLATFORM_OWNER,
  UserRole.INSTITUTION_ADMIN,
  UserRole.DEPARTMENT_REVIEWER,
]));

// Validation schemas
const UploadDocumentSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(['POLICY', 'SYLLABUS', 'GUIDELINE', 'REPORT', 'OTHER']),
    departmentId: z.string().uuid().optional(),
  }),
});

router.post(
  '/upload',
  // Curating the shared knowledge base is an administrative action: reviewers
  // may read and ask, but only owners and institution admins may add documents.
  // Without this the restriction would live only in the UI.
  authorize([UserRole.PLATFORM_OWNER, UserRole.INSTITUTION_ADMIN]),
  upload.single('file'),
  validate(UploadDocumentSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { title, description, type, departmentId } = req.body;
      const file = req.file;

      if (!file) {
        res.status(400).json({ success: false, error: 'No file uploaded' });
        return;
      }
      
      const user = req.user!;
      if (!user.tenantId) {
         res.status(400).json({ success: false, error: 'User does not belong to a tenant' });
         return;
      }

      // Create Document and DocumentVersion
      const document = await prisma.document.create({
        data: {
          tenantId: user.tenantId,
          departmentId: departmentId,
          title,
          description,
          type,
          status: 'UPLOADED',
          versions: {
            create: {
              versionNumber: 1,
              fileUrl: file.path,
              uploadedBy: user.id,
            }
          }
        },
        include: { versions: true }
      });

      const version = document.versions[0];
      if (!version) {
        throw new Error('Document version was not created');
      }

      // Enqueue job for ingestion
      await documentIngestionQueue.add('document-ingestion', {
        documentId: document.id,
        versionId: version.id,
        fileUrl: version.fileUrl,
        tenantId: user.tenantId,
      });

      // Update status to PROCESSING
      const updated = await prisma.document.update({
        where: { id: document.id },
        data: { status: 'PROCESSING' },
        include: { versions: true }
      });

      res.status(201).json({ success: true, data: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Document upload failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload document',
        details: message,
      });
    }
  }
);

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const documents = await prisma.document.findMany({
      where: { tenantId: user.tenantId, deletedAt: null },
      include: { versions: { select: { id: true, versionNumber: true, createdAt: true }, orderBy: { versionNumber: 'desc' } } },
      orderBy: { createdAt: 'desc' }
    });

    // Aggregate chunk counts so the UI can show how much is actually indexed.
    const chunkCounts = await prisma.$queryRawUnsafe<{ id: string; count: bigint }[]>(
      `SELECT d.id AS id, count(c.id) AS count
         FROM documents d
         LEFT JOIN document_versions v ON v."documentId" = d.id
         LEFT JOIN document_chunks c ON c."documentVersionId" = v.id
        WHERE d."tenantId" = $1 AND d."deletedAt" IS NULL
        GROUP BY d.id`,
      user.tenantId
    );
    const counts = new Map(chunkCounts.map((r) => [r.id, Number(r.count)]));

    res.json({
      success: true,
      data: documents.map((d) => ({ ...d, chunkCount: counts.get(d.id) ?? 0 })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to fetch documents' });
  }
});

/** GET /api/v1/documents/:id — single document with chunk count */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const id = req.params['id'] as string;
    const document = await prisma.document.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        versions: { include: { _count: { select: { chunks: true } } }, orderBy: { versionNumber: 'desc' } },
        department: { select: { id: true, name: true } },
      },
    });
    if (!document) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }
    res.json({ success: true, data: document });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to fetch document' });
  }
});

/**
 * DELETE /api/v1/documents/:id — permanently removes the document.
 * Document versions and chunks cascade in the database; the stored file is
 * unlinked from disk so deleted documents do not accumulate embeddings.
 */
router.delete(
  '/:id',
  authorize([UserRole.PLATFORM_OWNER, UserRole.INSTITUTION_ADMIN]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const id = req.params['id'] as string;

      const document = await prisma.document.findFirst({
        where: { id, tenantId: user.tenantId },
        include: { versions: { select: { fileUrl: true } } },
      });
      if (!document) {
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }

      await prisma.document.delete({ where: { id } });

      for (const version of document.versions) {
        try {
          if (fs.existsSync(version.fileUrl)) {
            fs.unlinkSync(version.fileUrl);
          }
        } catch (unlinkError) {
          // A missing file must not fail the delete; the rows are already gone.
          console.error(`Failed to unlink ${version.fileUrl}:`, unlinkError);
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: 'Failed to delete document' });
    }
  }
);

/** POST /api/v1/documents/search — raw semantic matches over embedded chunks */
router.post('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, limit = 5 } = req.body as { query: string; limit?: number };
    if (!query || typeof query !== 'string' || !query.trim()) {
      res.status(400).json({ success: false, error: 'query is required' });
      return;
    }

    if (!isEmbeddingsConfigured()) {
      res.status(503).json({
        success: false,
        error: 'Semantic search is unavailable because GEMINI_API_KEY is not configured',
      });
      return;
    }

    const user = req.user!;
    const chunks = await retrieveChunks(user.tenantId!, query, Number(limit));

    res.json({ success: true, data: chunks });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Semantic search failed:', error);
    res.status(500).json({
      success: false,
      error: 'Semantic search failed',
      details: message,
    });
  }
});

/**
 * POST /api/v1/documents/ask — retrieval-augmented question answering.
 * Retrieves the top matching chunks, then has the LLM synthesise a readable
 * answer grounded in those chunks, returning the answer plus its sources.
 */
router.post('/ask', async (req: Request, res: Response): Promise<void> => {
  try {
    const { question, limit = 6 } = req.body as { question?: string; limit?: number };
    if (!question || typeof question !== 'string' || !question.trim()) {
      res.status(400).json({ success: false, error: 'question is required' });
      return;
    }

    if (!isEmbeddingsConfigured()) {
      res.status(503).json({
        success: false,
        error: 'Ask is unavailable because GEMINI_API_KEY is not configured',
      });
      return;
    }

    if (!env.LLM_API_KEY) {
      res.status(503).json({
        success: false,
        error: 'Ask is unavailable because LLM_API_KEY is not configured',
      });
      return;
    }

    const user = req.user!;
    const result = await answerFromKnowledgeBase(user.tenantId!, question, Number(limit));

    res.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Knowledge base question failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to answer the question',
      details: message,
    });
  }
});

export { router as documentsControllerRouter };
