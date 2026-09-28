import { PineconeStore } from '@langchain/pinecone';
import { embeddingsModel } from './embeddings-model';
import { assertPineconeIndexReady } from './pinecone';

const DEFAULT_TOP_K = 4;

// The retrieval counterpart to ingest-document.ts's write path — same
// PineconeStore.fromExistingIndex(embeddingsModel, { pineconeIndex })
// construction, just querying instead of writing. Returns plain chunk text,
// since the only caller (lib/tickets/auto-resolve-ticket.ts) just needs
// content to ground an LLM prompt, not to cite/link back to a doc.
export async function searchKnowledgeBase(
   query: string,
   topK: number = DEFAULT_TOP_K
): Promise<string[]> {
   const pineconeIndex = await assertPineconeIndexReady();

   const vectorStore = await PineconeStore.fromExistingIndex(embeddingsModel, {
      pineconeIndex,
   });

   const results = await vectorStore.similaritySearch(query, topK);
   return results.map((doc) => doc.pageContent);
}
