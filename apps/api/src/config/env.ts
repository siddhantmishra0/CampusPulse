import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  SUBMISSION_TOKEN_SECRET: z.string().default('change-me-submission-secret'),
  ANONYMITY_TOKEN_SALT: z.string().default('change-me-anonymity-salt'),
  FRONTEND_URL: z.string().url(),
  // LLM (Groq-compatible OpenAI API)
  LLM_API_KEY: z.string().default(''),
  LLM_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1'),
  LLM_MODEL_NAME: z.string().default('openai/gpt-oss-120b'),
  // Embeddings (Google Gemini — Groq has no embeddings endpoint)
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_EMBEDDING_MODEL: z.string().default('gemini-embedding-001'),
  // Must match the vector() width of DocumentChunk.embedding
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  // Cosine similarity floor for semantic search. Measured against the seeded
  // policy corpus with gemini-embedding-001: genuinely on-topic questions score
  // 0.58-0.76 while unrelated questions score 0.37-0.51, so 0.55 sits in the
  // gap and keeps full recall without admitting noise.
  SEARCH_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.55),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;

/** Typed app config derived from env */
export const config = {
  submissionTokenSecret: env.SUBMISSION_TOKEN_SECRET,
  anonymityTokenSalt: env.ANONYMITY_TOKEN_SALT,
};
