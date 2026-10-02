import { prisma } from '../../lib/prisma';
import { embedText, toPgVector } from '../../lib/embeddings';
import { llmStructured } from '../../lib/llm';
import { env } from '../../config/env';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';

export interface RetrievedChunk {
  id: string;
  chunkText: string;
  pageNumber: number | null;
  documentVersionId: string;
  documentTitle: string;
  documentType: string;
  score: number;
}

export interface KnowledgeAnswer {
  answer: string;
  sources: Array<{
    chunkId: string;
    documentTitle: string;
    documentType: string;
    pageNumber: number | null;
    score: number;
  }>;
  /** True when nothing in the knowledge base cleared SEARCH_MIN_SCORE. */
  grounded: boolean;
}

/**
 * Semantic retrieval over embedded chunks for a single tenant.
 * Applies the SEARCH_MIN_SCORE floor so unrelated queries return nothing
 * rather than the closest-but-irrelevant passages.
 */
export async function retrieveChunks(
  tenantId: string,
  query: string,
  limit: number
): Promise<RetrievedChunk[]> {
  const vectorStr = toPgVector(await embedText(query));
  const safeLimit = Math.min(Math.max(limit, 1), 20);

  return prisma.$queryRawUnsafe<RetrievedChunk[]>(
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
       AND 1 - (dc.embedding <=> $1::vector) >= $4
     ORDER BY dc.embedding <=> $1::vector
     LIMIT $3`,
    vectorStr,
    tenantId,
    safeLimit,
    env.SEARCH_MIN_SCORE
  );
}

function buildGroundedPrompt(question: string, chunks: RetrievedChunk[]): string {
  const context = chunks
    .map((c, i) => {
      const origin = c.pageNumber ? `${c.documentTitle} (page ${c.pageNumber})` : c.documentTitle;
      return `[${i + 1}] Source: ${origin}\n${c.chunkText.trim()}`;
    })
    .join('\n\n---\n\n');

  return [
    'Context excerpts retrieved from the institutional knowledge base:',
    '',
    context,
    '',
    `Question: ${question}`,
  ].join('\n');
}

const SYSTEM_PROMPT = [
  'You are the assistant for a university institutional knowledge base.',
  '',
  'Rules:',
  '1. Answer ONLY using the context excerpts provided. Never use outside knowledge.',
  '2. If the excerpts do not contain the answer, say exactly that the knowledge base does not cover it and suggest what to search for instead. Do not guess.',
  '3. Cite the excerpt numbers you relied on inline, like [1] or [2][3].',
  '4. If several excerpts overlap, merge them into one clear answer instead of repeating yourself.',
  '5. Lead with a direct one or two sentence answer, then add detail only if it helps.',
  '6. Write in plain readable prose. Use short bullet lists for multiple distinct rules. No headings unless the answer has multiple parts.',
].join('\n');

/**
 * Retrieve relevant excerpts and have the LLM synthesise a grounded answer.
 * When nothing clears the relevance floor the LLM is not called at all, which
 * avoids both wasted tokens and an invented answer.
 */
export async function answerFromKnowledgeBase(
  tenantId: string,
  question: string,
  limit: number
): Promise<KnowledgeAnswer> {
  const chunks = await retrieveChunks(tenantId, question, limit);

  if (chunks.length === 0) {
    return {
      answer:
        'The knowledge base does not contain any information relevant to this question. Try rephrasing it, or upload the relevant policy document.',
      sources: [],
      grounded: false,
    };
  }

  const response = await llmStructured.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(buildGroundedPrompt(question, chunks)),
  ]);

  return {
    answer: String(response.content).trim(),
    sources: chunks.map((c) => ({
      chunkId: c.id,
      documentTitle: c.documentTitle,
      documentType: c.documentType,
      pageNumber: c.pageNumber,
      score: Number(c.score),
    })),
    grounded: true,
  };
}
