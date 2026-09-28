import { ChatOpenAI } from '@langchain/openai';

// Shared by lib/polish-reply.ts and lib/summarize-ticket.ts so the model
// name lives in one place, configurable via OPENAI_MODEL instead of being
// hardcoded in both files.
export const openAiModel = new ChatOpenAI({
   model: process.env.OPENAI_MODEL || 'gpt-5-nano',
});
