# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Deskwise: an AI-powered support ticket management system (see `docs/project-scope.md`). Support emails become tickets that are auto-classified, summarized, and given AI-suggested replies via the Claude API, with a dashboard for agents/admins to manage them.

Auth and user management (`packages/server` + `packages/client`) are built end-to-end — see Architecture below for how. Beyond that, none of the other product features in `docs/project-scope.md` (tickets, AI classification, email ingestion) are implemented yet. `docs/implementation-plan.md` has the intended build order (auth → user management → ticket CRUD → AI features → email → dashboard), and `docs/tech-stack.md` has the intended stack (Postgres + Prisma, session auth, SendGrid/Mailgun, Claude API). Check these docs for intent before assuming current code reflects the target design.

`docs/` (root) covers product scope/stack/plan. There are no per-package setup docs under `packages/server/docs/` or `packages/client/docs/` (removed as unnecessary) — for Prisma/Better Auth/shadcn setup, use the tools' own docs or read the actual config.

## Commands

This is a Bun workspace monorepo (`packages/*`). Run commands from the repo root unless noted.

- Install deps: `bun install`
- Run both server and client in dev mode: `bun run dev` (runs `index.ts`, which uses `concurrently` to run `bun run dev` in both `packages/server` and `packages/client`)
- Format all files: `bun run format` (prettier --write .)

Server (`packages/server`):
- Dev (watch mode): `bun run dev`
- Start without watch: `bun run start`
- Regenerate Prisma client after a schema change: `bunx prisma generate`
- Create/apply a migration after a schema change: `bunx prisma migrate dev --name <migration-name>`
- Open Prisma Studio: `bunx prisma studio`
- Regenerate Better Auth's required models into `schema.prisma` after changing `lib/auth.ts`: `bunx @better-auth/cli@latest generate` (then run the migrate command above)

Client (`packages/client`):
- Dev server: `bun run dev`
- Build: `bun run build` (`tsc -b && vite build`)
- Lint: `bun run lint`
- Preview production build: `bun run preview`

No test framework is configured in either package yet.

A husky `pre-commit` hook runs `lint-staged`, which runs `prettier --write` on staged `*.{js,jsx,ts,tsx,css}` files.

## Architecture

- Bun workspaces: root `package.json` declares `packages/*` as workspaces; `server` and `client` are independent, tied together only by the root `index.ts` dev orchestrator.
- `packages/server`: Express 5 + TypeScript, ESM (`"type": "module"`), loads env vars via `dotenv`. Entry point `packages/server/index.ts`.
- Database: Prisma with the `@prisma/adapter-pg` driver adapter over `pg`/PostgreSQL. Schema at `packages/server/prisma/schema.prisma`; the generated client outputs to `packages/server/generated/prisma` (not the default `node_modules/@prisma/client` location) and is re-exported as a singleton from `packages/server/db.ts`.
- Auth: Better Auth (`packages/server/lib/auth.ts`) — email/password with `disableSignUp: true` (users are pre-provisioned — matches the admin-creates-agents model in `docs/project-scope.md`). `trustedOrigins` comes from `packages/server/lib/trusted-origins.ts` (shared with the global `cors()` origin check in `index.ts`, both sourced from `TRUSTED_ORIGINS`) — without it, authenticated POSTs (sign-out, etc.) get rejected with a 403 `Invalid Origin`, since Better Auth's origin check is separate from Express's `cors()`. `user.additionalFields.role` must stay declared here (and mirrored in `packages/client/src/lib/auth-client.ts`) or Better Auth silently drops it and `session.user.role` comes back `undefined`. The handler is mounted at `/api/auth` and must be registered *before* `express.json()`. `requireAuth` (`middleware/require-auth.ts`) attaches `req.user`/`req.session`; `requireAdmin` (`middleware/require-admin.ts`) checks `req.user.role === 'admin'` with no null check, so it must always run after `requireAuth`. `middleware/auth-limiter.ts` rate-limits credential paths (20 req/15min) ahead of the Better Auth handler. Soft-delete: `/api/users`'s delete route sets `User.deletedAt`, revokes sessions, and overwrites `email` to `` `deleted+${userId}@deskwise.invalid` `` instead of a hard delete — frees the original email for reuse (since `email` is globally `@@unique`) while keeping the row around for future ticket-history references; `auth.ts`'s `hooks.before` blocks sign-in for any soft-deleted user with a `FORBIDDEN` `APIError`.
- Migrations: `bunx prisma migrate dev` needs an interactive TTY — it fails under a non-interactive shell (e.g. an agent's Bash tool) with "environment is non-interactive". For scripted migration work, hand-write the migration folder/SQL and apply with `bunx prisma migrate deploy` instead, or have the user run `migrate dev` themselves.
- `packages/core` (`src/schemas.ts`) holds shared Zod schemas (`loginSchema`, `createUserSchema`, `editUserSchema`), consumed by both `packages/server` and `packages/client` as the package `core` (`"core": "workspace:*"`, symlinked by `bun install`). Cross-package imports must use the package name (`from 'core'`), not a relative path (`../../core`) — a relative import type-checks fine under TS's `bundler` resolution but fails at runtime under Bun, which doesn't apply `package.json` `exports` to relative paths. `src/role.ts` exports `Role` (`{ admin: 'admin', user: 'user' }` `as const`, plus the derived `Role` type) — a plain const object, not a TS `enum`, since `packages/client`'s `erasableSyntaxOnly` tsconfig option forbids real enums. **Always compare against `Role.admin`/`Role.user` from `core` instead of the raw string literals `'admin'`/`'user'`** — this is what `packages/client`'s route guards (`AdminRoute`) and role checks (`NavBar`, `UserRowActions`) already do. Server-side, prefer Prisma's own generated `Role` enum (`packages/server/generated/prisma/enums`, already used in `routes/users.ts`) over `core`'s — `packages/server/middleware/require-admin.ts` is a known holdout still using the `'admin'` string literal directly.
- `packages/client`: Vite + React 19, shadcn/ui + Tailwind v4. `authClient`'s `inferAdditionalFields` plugin (`lib/auth-client.ts`) must stay in sync with the server's `user.additionalFields` or `session.user.role` comes back `undefined`. Route guards (`ProtectedRoute`/`GuestRoute`/`AdminRoute`, under `components/routes/`) read `authClient.useSession()` directly. `main.tsx` wraps the tree in a `QueryClientProvider` for server-state fetching (`UsersPage`'s `useQuery`/`useMutation` against `/api/users`). `@tanstack/react-table` is pinned to `^8.21.3` — its `9.x` line is a from-scratch API rewrite incompatible with `components/data-table.tsx`'s classic-v8 shadcn `DataTable` pattern; don't let a routine dependency bump silently pull v9 back in.
- Formatting is enforced via Prettier (`singleQuote`, `tabWidth: 3`, `printWidth: 80`) and lint-staged/husky on commit; there is no shared ESLint config at the root — only `packages/client` has one.
