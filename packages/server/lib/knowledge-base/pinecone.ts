import { Errors, Pinecone } from '@pinecone-database/pinecone';
import type { Index } from '@pinecone-database/pinecone';

// Shared by ingest-document.ts (this directory, via
// assertPineconeIndexReady) and the knowledge-docs delete route (via
// deleteDocVectors). Reads PINECONE_API_KEY from the environment
// automatically.
export const pineconeClient = new Pinecone();

// The dimension text-embedding-3-small produces (see embeddings-model.ts,
// this directory).
const EMBEDDING_DIMENSION = 1536;

// Never creates or resizes the index — per the product requirement, a
// missing or mismatched index must fail loudly (surfaced on the
// KnowledgeDoc row by jobs/ingest-document-job.ts) rather than be silently
// provisioned.
export async function assertPineconeIndexReady(): Promise<Index> {
   const indexName = process.env.PINECONE_INDEX_NAME as string;

   let dimension: number | undefined;
   try {
      const indexModel = await pineconeClient.describeIndex(indexName);
      dimension = indexModel.dimension;
   } catch (err) {
      if (err instanceof Errors.PineconeNotFoundError) {
         throw new Error(
            `Pinecone index "${indexName}" does not exist. Create it in ` +
               `the Pinecone console with dimension ${EMBEDDING_DIMENSION} ` +
               'before uploading documents.'
         );
      }
      throw err;
   }

   if (dimension !== EMBEDDING_DIMENSION) {
      throw new Error(
         `Pinecone index "${indexName}" has dimension ${dimension}, but ` +
            `the embedding model produces ${EMBEDDING_DIMENSION}-dimension ` +
            'vectors. Use a matching index or change OPENAI_EMBEDDING_MODEL.'
      );
   }

   return pineconeClient.index(indexName);
}

// Deletes every vector for a doc by listing ids under the "<docId>#" prefix
// and deleting them by id — metadata-filter delete isn't reliably
// supported on Pinecone serverless indexes, so ids are the source of truth
// (see jobs/ingest-document-job.ts / ingest-document.ts (this directory),
// which mint
// them as `${docId}#${chunkIndex}`).
export async function deleteDocVectors(docId: number): Promise<void> {
   const index = pineconeClient.index(
      process.env.PINECONE_INDEX_NAME as string
   );
   const prefix = `${docId}#`;

   let paginationToken: string | undefined;
   do {
      const result = await index.listPaginated({ prefix, paginationToken });
      const ids = (result.vectors ?? [])
         .map((vector) => vector.id)
         .filter((id): id is string => !!id);

      if (ids.length > 0) {
         await index.deleteMany(ids);
      }

      paginationToken = result.pagination?.next;
   } while (paginationToken);
}
