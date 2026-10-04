import type { Job } from 'pg-boss';
import prisma from '../db';
import { sendEmail } from '../lib/email/send-email';
import { boss } from '../lib/queue';
import { Sentry } from '../lib/sentry';

// Queue name shared between the producers (routes/tickets.ts's reply-create
// route, and jobs/auto-resolve-ticket-job.ts's AI-reply branch) and this
// worker.
export const SEND_REPLY_EMAIL_QUEUE = 'send-reply-email';

type SendReplyEmailJobData = { replyId: number };

// Registers a long-running worker: pg-boss polls the queue's table and
// hands matching jobs to the callback below. Call once at server startup
// (see index.ts), after startQueue() — createQueue() is idempotent, so
// it's safe to call on every boot even though the queue already exists
// from a previous run.
export async function registerSendReplyEmailWorker(): Promise<void> {
   await boss.createQueue(SEND_REPLY_EMAIL_QUEUE);

   // Letting an error here throw (rather than try/catch) is deliberate,
   // same as classify-ticket-job.ts: it signals the job as failed to
   // pg-boss, which then owns retry/backoff, rather than silently
   // swallowing a SES/network failure. Nothing else's state depends
   // on the send succeeding, so a retry is always safe.
   await boss.work<SendReplyEmailJobData>(
      SEND_REPLY_EMAIL_QUEUE,
      async ([job]: Job<SendReplyEmailJobData>[]) => {
         if (!job) return;

         try {
            const reply = await prisma.ticketReply.findUnique({
               where: { id: job.data.replyId },
               select: {
                  body: true,
                  bodyHtml: true,
                  ticket: {
                     select: {
                        subject: true,
                        senderEmail: true,
                        senderName: true,
                     },
                  },
               },
            });

            // Reply may no longer exist by the time this job runs —
            // nothing to send.
            if (!reply) return;

            await sendEmail({
               to: reply.ticket.senderEmail,
               toName: reply.ticket.senderName,
               subject: `Re: ${reply.ticket.subject}`,
               text: reply.body,
               html: reply.bodyHtml,
            });
         } catch (err) {
            // Reported here, then rethrown so pg-boss still owns
            // retry/backoff as before.
            Sentry.captureException(err);
            throw err;
         }
      }
   );
}
