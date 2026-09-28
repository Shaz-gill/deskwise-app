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

```bash
bun run seed          # admin user from ADMIN_EMAIL/ADMIN_PASSWORD — idempotent, safe to re-run
bun run seed:users    # demo roster: admin "Shaz Gill" + 14 agents — idempotent, safe to re-run
bun run seed:tickets  # 100 demo e-commerce tickets — NOT idempotent, adds more rows every run
```

`seed:tickets` looks up whichever users `seed:users` created to assign
non-open tickets to real agents, so run `seed:users` first if you want that.
