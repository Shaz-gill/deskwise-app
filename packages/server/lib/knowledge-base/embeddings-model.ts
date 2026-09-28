import { OpenAIEmbeddings } from '@langchain/openai';

// Shared by lib/knowledge-base/ingest-document.ts, mirroring
// lib/tickets/openai-model.ts's singleton pattern. The dimension this model
// produces must match the Pinecone index's dimension — see
// lib/knowledge-base/pinecone.ts's assertPineconeIndexReady().
export const embeddingsModel = new OpenAIEmbeddings({
   model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
});
