import { ChatOpenAI } from '@langchain/openai';
import { env } from '../config/env';

/**
 * Singleton LangChain ChatOpenAI client configured for the Groq-compatible endpoint.
 * Set LLM_API_KEY, LLM_BASE_URL, and LLM_MODEL_NAME in your environment.
 *
 * Defaults:
 *   LLM_BASE_URL  = https://api.groq.com/openai/v1
 *   LLM_MODEL_NAME = openai/gpt-oss-120b
 */
export const llm = new ChatOpenAI({
  apiKey: env.LLM_API_KEY,
  configuration: {
    baseURL: env.LLM_BASE_URL,
  },
  model: env.LLM_MODEL_NAME,
  temperature: 0.7,
  maxTokens: 512,
  timeout: 30_000,
});

/**
 * A stricter instance for structured output tasks (lower temperature, more tokens).
 * Used by the AI analysis worker and conversation summarisation.
 */
export const llmStructured = new ChatOpenAI({
  apiKey: env.LLM_API_KEY,
  configuration: {
    baseURL: env.LLM_BASE_URL,
  },
  model: env.LLM_MODEL_NAME,
  temperature: 0,
  maxTokens: 1024,
  timeout: 30_000,
});
