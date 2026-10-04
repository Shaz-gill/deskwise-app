import { PineconeStore } from '@langchain/pinecone';
import { chunkText } from './chunk-text';
import { embeddingsModel } from './embeddings-model';
import { extractText } from './extract-text';
import { assertPineconeIndexReady } from './pinecone';
import { readKnowledgeFile } from './storage';

// The one orchestration function for turning an uploaded file into
// searchable vectors — mirrors the "one lib/*.ts file, one function, plain
// object in/out" shape of lib/tickets/polish-reply.ts / summarize-ticket.ts.
// Called only by jobs/ingest-document-job.ts, which owns the KnowledgeDoc
// row's status transitions.
export async function ingestDocument({
   docId,
   storedPath,
   filename,
}: {
   docId: number;
   storedPath: string;
   filename: string;
}): Promise<{ chunkCount: number }> {
   const pineconeIndex = await assertPineconeIndexReady();

   const buffer = await readKnowledgeFile(storedPath);
   const text = await extractText(buffer, filename);
   const chunks = chunkText(text);

   if (chunks.length === 0) {
      throw new Error(`No extractable text found in "${filename}"`);
   }

   const uploadedAt = new Date().toISOString();
   const documents = chunks.map((chunk, chunkIndex) => ({
      pageContent: chunk,
      metadata: { docId, filename, chunkIndex, uploadedAt },
   }));

   const vectorStore = await PineconeStore.fromExistingIndex(embeddingsModel, {
      pineconeIndex,
   });

   await vectorStore.addDocuments(documents, {
      ids: documents.map((_, chunkIndex) => `${docId}#${chunkIndex}`),
   });

   return { chunkCount: chunks.length };
}
