import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  LLM_API_KEY: z.string().min(1),
  LLM_BASE_URL: z.string().url(),
  LLM_MODEL_NAME: z.string().min(1),
  // Embeddings (Google Gemini — Groq has no embeddings endpoint)
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_EMBEDDING_MODEL: z.string().default('gemini-embedding-001'),
  // Must match the vector() width of DocumentChunk.embedding
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('Worker environment variable validation failed:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
