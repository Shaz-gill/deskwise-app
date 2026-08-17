# Prisma Setup (with Bun + PostgreSQL)

Steps to set up Prisma in a project using Bun as the package manager and PostgreSQL as the database, with the `pg` driver adapter.

## 1. Install Prisma as a dev dependency

```bash
bun add prisma --dev
```

**What this generates:** Nothing on disk yet — it just installs the `prisma` CLI package into `node_modules` and adds it to `devDependencies` in `package.json` (and updates `bun.lock`). This CLI is what powers the `bunx prisma ...` commands used below.

## 2. Install the Prisma client, Postgres adapter, and `pg` driver

```bash
bun add @prisma/client @prisma/adapter-pg pg
```

**What this generates:** Installs three runtime packages into `node_modules` and adds them to `dependencies` in `package.json`:

- `@prisma/client` — the (not-yet-generated) database client your code will import
- `@prisma/adapter-pg` — driver adapter that lets Prisma Client talk to Postgres via `pg`
- `pg` — the underlying Node/Bun PostgreSQL driver

No project files are created yet — this step is just dependency installation.

## 3. Initialize Prisma with PostgreSQL as the datasource

```bash
bunx prisma init --datasource-provider postgresql
```

**What this generates:**

- `prisma/schema.prisma` — a new schema file pre-filled with a `generator client` block and a `datasource db` block set to `provider = "postgresql"`, reading the connection string from `DATABASE_URL`
- `.env` — created (if it doesn't already exist) with a placeholder `DATABASE_URL="postgresql://..."` variable for you to fill in
- If `.env` already existed, Prisma appends the `DATABASE_URL` placeholder to it instead of overwriting it
- It also prints next-step instructions in the terminal (set your DB connection string, then run `prisma generate` or `prisma migrate dev`)

No tables or database changes happen at this step — it's purely local config scaffolding.

## 4. Generate the Prisma client

```bash
bunx prisma generate
```

**What this generates:** Reads `prisma/schema.prisma` and generates the actual Prisma Client code into `node_modules/@prisma/client` (or a custom output path if configured), based on your models. This is the typed client (e.g. `PrismaClient`) you import in your app code — it doesn't touch your database, it just generates code matching your schema.

Run this again any time you change `schema.prisma`.

## Notes

- Update `DATABASE_URL` in `.env` before running `prisma generate` against a real database, or before running migrations.
- To create/apply migrations later: `bunx prisma migrate dev --name <migration-name>`
- To open Prisma Studio: `bunx prisma studio`
