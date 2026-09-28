import type { Job } from 'pg-boss';
import prisma from '../db';
import {
   KnowledgeDocStatus,
   TicketReplySenderType,
   TicketStatus,
} from '../generated/prisma/enums';
import { getOrCreateAiAssistantUser } from '../lib/tickets/ai-assistant-user';
import { autoResolveTicket } from '../lib/tickets/auto-resolve-ticket';
import { searchKnowledgeBase } from '../lib/knowledge-base/search-knowledge-base';
import { boss } from '../lib/queue';

// Queue name shared between the producer (routes/tickets.ts's inbound-email
// webhook, create-ticket branch only) and this worker.
export const AUTO_RESOLVE_TICKET_QUEUE = 'auto-resolve-ticket';

type AutoResolveTicketJobData = { ticketId: number };

// Registers a long-running worker: pg-boss polls the queue's table and
// hands matching jobs to the callback below. Call once at server startup
// (see index.ts), after startQueue() — createQueue() is idempotent, so
// it's safe to call on every boot even though the queue already exists
// from a previous run.
export async function registerAutoResolveTicketWorker(): Promise<void> {
   await boss.createQueue(AUTO_RESOLVE_TICKET_QUEUE);

   await boss.work<AutoResolveTicketJobData>(
      AUTO_RESOLVE_TICKET_QUEUE,
      async ([job]: Job<AutoResolveTicketJobData>[]) => {
         if (!job) return;
         const { ticketId } = job.data;

         const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            select: {
               subject: true,
               body: true,
               senderName: true,
               status: true,
            },
         });

         // Ticket may no longer exist, or may already be non-'new' (e.g.
         // reprocessed, or an agent somehow already touched it) by the time
         // this job runs — nothing to do.
         if (!ticket || ticket.status !== TicketStatus.new) return;

         // Guarded new -> processing transition: if this races with
         // something else (shouldn't happen in practice, since a ticket
         // only ever gets one auto-resolve job), count === 0 and we back
         // off rather than double-processing.
         const { count: claimed } = await prisma.ticket.updateMany({
            where: { id: ticketId, status: TicketStatus.new },
            data: { status: TicketStatus.processing },
         });
         if (claimed === 0) return;

         // Everything from here on is wrapped in a try/catch — unlike
         // classify-ticket-job.ts (which lets errors throw for pg-boss to
         // retry, safe since a classification failure just leaves
         // `category: null`, a harmless already-visible state), a failure
         // here after the ticket has moved to 'processing' would leave it
         // stuck in an internal, hidden-from-the-UI state forever. Always
         // fall back to 'open' on any failure so the ticket surfaces to a
         // human no matter what breaks (missing/misconfigured Pinecone
         // index, OpenAI error, etc).
         try {
            const readyDocCount = await prisma.knowledgeDoc.count({
               where: { status: KnowledgeDocStatus.ready },
            });

            const context =
               readyDocCount === 0
                  ? []
                  : await searchKnowledgeBase(
                       `${ticket.subject}\n\n${ticket.body}`
                    );

            const { canResolve, reply } =
               context.length === 0
                  ? { canResolve: false, reply: null }
                  : await autoResolveTicket({
                       subject: ticket.subject,
                       body: ticket.body,
                       senderName: ticket.senderName,
                       context,
                    });

            if (canResolve && reply) {
               const aiUser = await getOrCreateAiAssistantUser();

               await prisma.$transaction(async (tx) => {
                  // Guarded processing -> resolved transition: if an agent
                  // already moved the ticket while this job was in flight,
                  // count === 0 and we skip posting a reply entirely, so we
                  // never clobber a human's concurrent action.
                  const { count } = await tx.ticket.updateMany({
                     where: { id: ticketId, status: TicketStatus.processing },
                     data: { status: TicketStatus.resolved },
                  });
                  if (count === 0) return;

                  await tx.ticketReply.create({
                     data: {
                        body: reply,
                        ticketId,
                        authorId: aiUser.id,
                        senderType: TicketReplySenderType.ai,
                     },
                  });
               });
            } else {
               await prisma.ticket.updateMany({
                  where: { id: ticketId, status: TicketStatus.processing },
                  data: { status: TicketStatus.open },
               });
            }
         } catch (err) {
            console.error(
               `Auto-resolve failed for ticket ${ticketId}, leaving it open for a human:`,
               err
            );
            await prisma.ticket.updateMany({
               where: { id: ticketId, status: TicketStatus.processing },
               data: { status: TicketStatus.open },
            });
         }
      }
   );
}
