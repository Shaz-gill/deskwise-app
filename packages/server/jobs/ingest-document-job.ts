import type { Job } from 'pg-boss';
import { KnowledgeDocStatus } from '../generated/prisma/enums';
import prisma from '../db';
import { ingestDocument } from '../lib/knowledge-base/ingest-document';
import { boss } from '../lib/queue';

// Queue name shared between the producer (routes/knowledge-docs.ts's POST /
// calls boss.send(INGEST_DOCUMENT_QUEUE, ...)) and this worker.
export const INGEST_DOCUMENT_QUEUE = 'ingest-document';

type IngestDocumentJobData = { docId: number };

// Registers a long-running worker: pg-boss polls the queue's table and
// hands matching jobs to the callback below. Call once at server startup
// (see index.ts), after startQueue().
export async function registerIngestDocumentWorker(): Promise<void> {
   await boss.createQueue(INGEST_DOCUMENT_QUEUE);

   await boss.work<IngestDocumentJobData>(
      INGEST_DOCUMENT_QUEUE,
      async ([job]: Job<IngestDocumentJobData>[]) => {
         if (!job) return;

         const doc = await prisma.knowledgeDoc.findUnique({
            where: { id: job.data.docId },
         });

         // Doc may have been deleted before this job ran.
         if (!doc) return;

         try {
            const { chunkCount } = await ingestDocument({
               docId: doc.id,
               filePath: doc.path,
               filename: doc.filename,
            });

            await prisma.knowledgeDoc.update({
               where: { id: doc.id },
               data: {
                  status: KnowledgeDocStatus.ready,
                  chunkCount,
                  error: null,
               },
            });
         } catch (err) {
            console.error('Failed to ingest document:', err);

            // Caught (not rethrown, unlike classify-ticket-job's worker):
            // this failure already has a durable, user-visible sink — the
            // doc row's status/error, shown in the knowledge base UI — so
            // there's no benefit to pg-boss retrying a doomed ingestion
            // (e.g. a misconfigured Pinecone index) over and over.
            await prisma.knowledgeDoc.update({
               where: { id: doc.id },
               data: {
                  status: KnowledgeDocStatus.failed,
                  error:
                     err instanceof Error ? err.message : 'Ingestion failed',
               },
            });
         }
      }
   );
}
