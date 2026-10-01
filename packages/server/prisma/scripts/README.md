# Resetting the database

Two ways to get back to a clean database, plus how to reseed afterward. Run
all of this yourself in an interactive terminal — `prisma migrate dev` and
`prisma migrate reset` both need a TTY and fail under a non-interactive
shell (e.g. an agent's Bash tool). Commands assume you're in
`packages/server` and that `psql`/database name/user match your
`DATABASE_URL` in `.env` (adjust `deskwise-app`/`postgres` below if yours
differ).

## Option A — delete the database and create a new empty one

1. Drop it:
   ```bash
   psql -U postgres -h localhost -c 'DROP DATABASE "deskwise-app";'
   ```
2. Create a new empty one:
   ```bash
   psql -U postgres -h localhost -c 'CREATE DATABASE "deskwise-app";'
   ```
3. Apply migrations:
   - If `prisma/migrations/` still exists: `bunx prisma migrate deploy`
   - If the migrations folder is also gone, generate a fresh initial
     migration from the current `schema.prisma` instead:
     `bunx prisma migrate dev --name init`
4. Seed (see below).

## Option B — keep the database, just empty out existing data

```bash
bunx prisma migrate reset
```

This drops all data, reapplies every existing migration, and — per
`prisma.config.ts`'s `migrations.seed` — automatically runs `bun run seed`
for you. It'll ask for confirmation; confirm it.

## Seeding, in order

Demo data is themed as "Pathlight Academy," a fictional online-learning
platform.

```bash
bun run seed               # admin + the AI Assistant user — idempotent, safe to re-run
bun run seed:users         # demo roster: admin "Shaz Gill" + 14 agents across 4 informal teams — idempotent, safe to re-run
bun run seed:tickets       # 140 demo LMS support tickets + reply threads — idempotent (TRUNCATEs ticket/ticket_reply, then reinserts deterministic data), safe to re-run
bun run seed:knowledge-base # 10 LMS help-center PDFs (refunds, duplicate charges, course access, video playback, certificates, login/2FA, coupons, instructor payouts, course publishing, team licenses) — idempotent (deletes existing docs/vectors/files, then regenerates all 10), safe to re-run
```

`seed:tickets` has two **hard** prerequisites now (it throws a clear error
if either is missing): `bun run seed` must have already run, since a slice
of resolved tickets get a single AI-authored resolution reply via the real
`getAiAssistantUser()` lookup; and `bun run seed:users` must have already
run, since every ticket's assignee and every human-authored reply comes
from the live agent roster, grouped by the informal team
(billing/technical/instructor_success/general) in `seed-users.ts`. It also
upserts one `User` row (`role: customer`) per seeded customer sender, so
replies they "sent" show their real name — these rows aren't touched by the
ticket/reply TRUNCATE and are safe to leave in place across reseeds. If
your Postgres user lacks `TRUNCATE` privilege, swap the
`$executeRawUnsafe('TRUNCATE ...')` call at the top of `seed-tickets.ts`'s
`main()` for `prisma.$transaction([prisma.ticketReply.deleteMany(), prisma.ticket.deleteMany()])`
instead — slower and it won't reset the id sequences, but works under any
privilege level.

`seed:knowledge-base` needs at least one user to exist (run `seed` or
`seed:users` first) to attribute the docs to, and ingests each PDF into
Pinecone directly (bypassing the app's pg-boss queue, since no server is
running) — it needs `PINECONE_API_KEY`/`PINECONE_INDEX_NAME`/`OPENAI_API_KEY`
set in `.env` and an existing Pinecone index matching the embedding model's
dimension (see `packages/server/lib/knowledge-base/pinecone.ts`), or each
doc will be created with `status: failed` and a clear error message instead.
Because every run deletes and recreates all 10 docs from scratch, every run
also re-embeds and re-upserts all 10 to Pinecone — unlike the old
skip-if-exists behavior, an unchanged rerun is no longer free.

Policy figures referenced in both `seed-tickets.ts` and
`seed-knowledge-base.ts` (refund window, payout schedule, certificate
thresholds, etc.) are the same invented policy, authored once and kept
consistent across both files — if you change one, change the other to
match.

## One-time schema note

This demo data relies on a `customer` value on the `Role` enum (added
specifically so seeded customer-authored ticket replies can have a real,
correctly-scoped author distinct from staff agents). If you're setting up
from a fresh clone, running the migrations in `prisma/migrations/` (via
either reset option above) brings this in automatically — no separate step
needed.
