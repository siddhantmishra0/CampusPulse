import { ChatOpenAI } from '@langchain/openai';
import { env } from '../config/env';

export const llm = new ChatOpenAI({
  apiKey: env.LLM_API_KEY,
  configuration: {
    baseURL: env.LLM_BASE_URL,
  },
  model: env.LLM_MODEL_NAME,
  temperature: 0,
  maxTokens: 1500,
});
