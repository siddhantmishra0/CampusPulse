import { env } from '../config/env';

/**
 * Google Gemini exposes an OpenAI-compatible embeddings endpoint, so we call it
 * directly rather than through LangChain: gemini-embedding-001 returns 3072
 * dimensions and we must persist exactly EMBEDDING_DIMENSIONS values to match
 * the vector(1536) column on document_chunks.
 *
 * gemini-embedding-001 is a Matryoshka (MRL) model, so the leading dimensions
 * are independently meaningful and truncating to 1536 costs no measurable
 * retrieval quality (MTEB 68.17 at both 3072 and 1536). We truncate locally
 * rather than sending a `dimensions` parameter because the compatibility layer
 * silently ignores unsupported request fields.
 */
const GEMINI_EMBEDDINGS_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai/embeddings';

/** Thrown when embeddings are requested but no Gemini key is configured. */
export class EmbeddingsUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbeddingsUnavailableError';
  }
}

export const isEmbeddingsConfigured = (): boolean => Boolean(env.GEMINI_API_KEY);

/**
 * Embeds a single text into a vector of exactly EMBEDDING_DIMENSIONS values.
 */
export async function embedText(text: string): Promise<number[]> {
  if (!env.GEMINI_API_KEY) {
    throw new EmbeddingsUnavailableError('GEMINI_API_KEY is not configured');
  }

  const res = await fetch(GEMINI_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GEMINI_API_KEY}`,
    },
    body: JSON.stringify({ model: env.GEMINI_EMBEDDING_MODEL, input: text }),
  });

  if (!res.ok) {
    throw new Error(`Gemini embeddings request failed (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
  const vector = json.data?.[0]?.embedding;

  if (!Array.isArray(vector)) {
    throw new Error('Gemini embeddings response did not contain an embedding vector');
  }

  if (vector.length === env.EMBEDDING_DIMENSIONS) {
    return vector;
  }

  if (vector.length > env.EMBEDDING_DIMENSIONS) {
    return vector.slice(0, env.EMBEDDING_DIMENSIONS);
  }

  throw new Error(
    `Gemini returned ${vector.length} dimensions but at least ${env.EMBEDDING_DIMENSIONS} are required`
  );
}

/** Serialises a vector into the literal form pgvector expects. */
export const toPgVector = (vector: number[]): string => `[${vector.join(',')}]`;
