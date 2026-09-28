import { PgBoss } from 'pg-boss';

// pg-boss is a Postgres-backed job queue — queued/in-flight jobs live as
// rows in the same database as the app (via DATABASE_URL, in pg-boss's own
// schema), so no separate queue infra (Redis, SQS, etc.) is needed. `boss`
// is a singleton shared by every producer (e.g. routes/tickets.ts's
// inbound-email webhook) and worker (jobs/classify-ticket-job.ts).
export const boss = new PgBoss(process.env.DATABASE_URL as string);

boss.on('error', (err) => console.error('pg-boss error:', err));

// Must be awaited once at server startup (see index.ts) before anything
// calls boss.send()/boss.work() — it creates pg-boss's internal tables on
// first run and starts its maintenance/polling loop.
export async function startQueue(): Promise<void> {
   await boss.start();
}
