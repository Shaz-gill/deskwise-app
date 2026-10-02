import type { Job } from 'pg-boss';
import prisma from '../db';
import { classifyTicket } from '../lib/tickets/classify-ticket';
import { boss } from '../lib/queue';
import { Sentry } from '../lib/sentry';

// Queue name shared between the producer (routes/tickets.ts's inbound-email
// webhook calls boss.send(CLASSIFY_TICKET_QUEUE, ...)) and this worker —
// pg-boss just matches jobs to workers by this string, so it must be
// identical on both sides.
export const CLASSIFY_TICKET_QUEUE = 'classify-ticket';

type ClassifyTicketJobData = { ticketId: number };

// Registers a long-running worker: pg-boss polls the queue's table and
// hands matching jobs to the callback below. Call once at server startup
// (see index.ts), after startQueue() — createQueue() is idempotent, so
// it's safe to call on every boot even though the queue already exists
// from a previous run.
export async function registerClassifyTicketWorker(): Promise<void> {
   await boss.createQueue(CLASSIFY_TICKET_QUEUE);

   // boss.work()'s callback receives an array of jobs (it can batch them),
   // but this worker only ever requests one at a time — [job] destructures
   // that single element instead of looping. Letting an error here throw
   // (rather than try/catch) is deliberate: it signals the job as failed
   // to pg-boss, which then owns retry/backoff, instead of silently
   // swallowing an OpenAI/DB failure and leaving the ticket permanently
   // uncategorized.
   await boss.work<ClassifyTicketJobData>(
      CLASSIFY_TICKET_QUEUE,
      async ([job]: Job<ClassifyTicketJobData>[]) => {
         if (!job) return;

         try {
            const ticket = await prisma.ticket.findUnique({
               where: { id: job.data.ticketId },
               select: { subject: true, body: true },
            });

            // Ticket may no longer exist by the time this job runs —
            // nothing to classify.
            if (!ticket) return;

            const category = await classifyTicket({
               subject: ticket.subject,
               body: ticket.body,
            });

            // `category: null` guard: don't clobber a category an agent has
            // since set by hand (routes/tickets.ts's PATCH /:id) just
            // because this job happened to run late.
            await prisma.ticket.updateMany({
               where: { id: job.data.ticketId, category: null },
               data: { category },
            });
         } catch (err) {
            // Reported here (unlike pg-boss's own retry/dead-letter
            // bookkeeping) so a persistently failing classification is
            // actually visible, then rethrown so pg-boss still owns
            // retry/backoff as before.
            Sentry.captureException(err);
            throw err;
         }
      }
   );
}
