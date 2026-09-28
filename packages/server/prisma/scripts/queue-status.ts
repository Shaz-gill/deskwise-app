import 'dotenv/config';
import { boss } from '../../lib/queue';
import { CLASSIFY_TICKET_QUEUE } from '../../jobs/classify-ticket-job';

// Manual dev tool: prints the classify-ticket queue's current job counts
// (queued/active/completed/failed), pulled straight from pg-boss's own
// tables in Postgres — this works from a separate one-off process (unlike
// boss.getWipData(), which only reflects the in-memory workers of whatever
// process calls it, i.e. only useful from inside the running server).
async function main() {
   await boss.start();

   const queue = await boss.getQueue(CLASSIFY_TICKET_QUEUE);
   if (!queue) {
      console.log(
         `Queue "${CLASSIFY_TICKET_QUEUE}" doesn't exist yet — start the ` +
            'server at least once first (index.ts calls createQueue() on boot).'
      );
      return;
   }

   console.log(queue);
}

main()
   .catch((error) => {
      console.error(error);
      process.exitCode = 1;
   })
   .finally(async () => {
      await boss.stop();
   });
