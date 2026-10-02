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
import { env } from '../../config/env';
import { OpenAIEmbeddings } from '@langchain/openai';

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
router.use(authorize([UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER]));

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

      // Enqueue job for ingestion
      await documentIngestionQueue.add('document-ingestion', {
        documentId: document.id,
        versionId: version.id,
        fileUrl: version.fileUrl,
        tenantId: user.tenantId,
      });

      // Update status to PROCESSING
      await prisma.document.update({
        where: { id: document.id },
        data: { status: 'PROCESSING' }
      });

      res.status(201).json({ success: true, data: document });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: 'Failed to upload document' });
    }
  }
);

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const documents = await prisma.document.findMany({
      where: { tenantId: user.tenantId },
      include: { versions: { select: { id: true, versionNumber: true, createdAt: true }, orderBy: { versionNumber: 'desc' } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: documents });
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

/** DELETE /api/v1/documents/:id — soft delete */
router.delete('/:id', authorize([UserRole.INSTITUTION_ADMIN]), async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const id = req.params['id'] as string;
    await prisma.document.update({
      where: { id, tenantId: user.tenantId },
      data: { deletedAt: new Date() },
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to delete document' });
  }
});

/** POST /api/v1/documents/search — semantic search over embedded chunks */
router.post('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, limit = 5 } = req.body as { query: string; limit?: number };
    if (!query || typeof query !== 'string') {
      res.status(400).json({ success: false, error: 'query is required' });
      return;
    }
    const user = req.user!;
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: env.LLM_API_KEY,
      modelName: 'text-embedding-3-small',
    });
    const vector = await embeddings.embedQuery(query);
    const vectorStr = `[${vector.join(',')}]`;
    const safeLimit = Math.min(Math.max(Number(limit), 1), 20);

    // pgvector cosine distance search — returns closest chunks
    const chunks: Array<{
      id: string;
      chunkText: string;
      pageNumber: number | null;
      documentVersionId: string;
      documentTitle: string;
      documentType: string;
      score: number;
    }> = await prisma.$queryRawUnsafe(
      `SELECT
         dc.id,
         dc."chunkText",
         dc."pageNumber",
         dc."documentVersionId",
         d.title AS "documentTitle",
         d.type  AS "documentType",
         1 - (dc.embedding <=> $1::vector) AS score
       FROM document_chunks dc
       JOIN document_versions dv ON dv.id = dc."documentVersionId"
       JOIN documents d ON d.id = dv."documentId"
       WHERE dc."tenantId" = $2
         AND d."deletedAt" IS NULL
         AND d.status = 'READY'
       ORDER BY dc.embedding <=> $1::vector
       LIMIT $3`,
      vectorStr,
      user.tenantId,
      safeLimit,
    );

    res.json({ success: true, data: chunks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Semantic search failed' });
  }
});

export { router as documentsControllerRouter };
