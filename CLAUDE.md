# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Deskwise: an AI-powered support ticket management system. Support emails become tickets that are auto-classified, summarized, and either auto-resolved or given AI-polished agent replies, with a dashboard for agents/admins to manage them. See `README.md` for the full feature/architecture overview.

Built end-to-end: auth, user management, ticket CRUD (list/detail/reply, assignment, status/category updates, inbound-email webhook intake), ticket classification, summarization, reply-polishing, knowledge-base-grounded auto-resolution, and the dashboard (ticket stats + daily chart, at `/`, backed by `GET /api/tickets/stats`). Not yet implemented: agent-facing suggested-reply-*drafting* (a human-reviewed AI-written first draft, as opposed to polishing an agent's own draft or full auto-resolution), real email-provider ingestion (SendGrid/Mailgun — today there's only a generic secret-gated JSON webhook), and outbound email sending.

**All AI features, current and future, must go through LangChain** (`@langchain/core`/`@langchain/openai`, per `lib/tickets/openai-model.ts`) rather than a provider SDK called directly — a deliberate standing choice, not just how the existing features happen to be built. Model is OpenAI, configurable via `OPENAI_MODEL` (default `gpt-5-nano`).

There's no `docs/` folder — treat this file, `README.md`, and the actual code/config as the source of truth. The one exception is `packages/server/prisma/scripts/README.md`, a runbook for resetting the database (drop-and-recreate vs. `prisma migrate reset`) and reseeding in order — check it before improvising `psql`/`prisma migrate` commands by hand.

## Simplicity

- Implement the simplest solution that meets the current requirement. No speculative features, config options, or abstractions for hypothetical future needs.
- Prefer editing existing code over adding new files, layers, or wrappers.
- Don't add a dependency when a few lines of code or the standard library will do.
- Introduce an abstraction (interface, factory, base class, generic helper) only once there are at least two real uses.
- Keep functions small and flat; avoid deep nesting and indirection.
- Match the patterns already in the codebase rather than inventing new ones.
- If a task seems to need a larger design change, stop and propose it briefly before building it.

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
- Seed the initial admin user (from `ADMIN_EMAIL`/`ADMIN_PASSWORD`) and the AI Assistant bot account: `bun run seed`
- Seed a demo agent roster, grouped into informal support teams (safe to re-run): `bun run seed:users`
- Seed 140 demo support tickets + reply threads for a fictional online-learning-platform tenant ("Pathlight Academy") — deterministic (fixed PRNG seed) and idempotent (`TRUNCATE`s its own tables, then reinserts, rather than appending): `bun run seed:tickets`
- Seed 10 demo help-center PDFs straight into the knowledge base, ingested into Pinecone inline — idempotent via full wipe-then-recreate (deletes existing docs/vectors/files first, so every run re-embeds everything rather than skipping unchanged ones): `bun run seed:knowledge-base`

Client (`packages/client`):

- Dev server: `bun run dev`
- Build: `bun run build` (`tsc -b && vite build`)
- Lint: `bun run lint`
- Preview production build: `bun run preview`

No test framework is configured in either package yet. A husky `pre-commit` hook runs `lint-staged`, which runs `prettier --write` on staged `*.{js,jsx,ts,tsx,css}` files.

## Git

- Never run `git commit`, `git push`, or any command that creates commits or modifies remotes (including amend, rebase, merge, tag, or force operations).
- Leave all changes uncommitted in the working tree for review.
- Only commit or push if explicitly asked in that session; pushes go straight to `origin/master` — no branch/PR flow, since this is a solo project.

## Architecture

- Bun workspaces: root `package.json` declares `packages/*` as workspaces (`server`, `client`, `core`), tied together only by the root `index.ts` dev orchestrator.
- `packages/server`: Express 5 + TypeScript, ESM. Entry point `packages/server/index.ts`. Prisma with the `@prisma/adapter-pg` driver adapter over `pg`/PostgreSQL; schema at `prisma/schema.prisma`; generated client outputs to `generated/prisma` (not the default location) and is re-exported as a singleton from `db.ts`.
- `packages/core` (`src/schemas.ts` + `src/enums.ts`) holds shared Zod schemas and const-object "enums" (not real TS `enum`s — `packages/client`'s `erasableSyntaxOnly` tsconfig forbids those), consumed by both `server` and `client` as the `core` workspace package. **Cross-package imports must use the package name (`from 'core'`), not a relative path** — a relative import type-checks under TS's `bundler` resolution but fails at runtime under Bun, which doesn't apply `package.json` `exports` to relative paths. Server-side, prefer Prisma's own generated enums (`packages/server/generated/prisma/enums`) over `core`'s where both exist. Always compare against these exports (`Role.admin`, `TicketStatus.Open`) instead of raw string literals.
- Auth: Better Auth (`packages/server/lib/auth.ts`) — email/password, `disableSignUp: true` (accounts are admin-provisioned, no public sign-up). `trustedOrigins` (`lib/trusted-origins.ts`) is shared with the global `cors()` check in `index.ts`, both sourced from `TRUSTED_ORIGINS` — without it, authenticated POSTs get rejected with a 403 `Invalid Origin`. `user.additionalFields.role` must stay declared here *and* mirrored in `packages/client/src/lib/auth-client.ts` or `session.user.role` comes back `undefined`. Handler is mounted at `/api/auth`, registered *before* `express.json()`. `requireAdmin` must always run after `requireAuth` (no null check on `req.user`). Both server npm scripts explicitly set `NODE_ENV=development` — without it, Better Auth's rate limiter can't resolve a client IP locally and every request shares one rate-limit bucket. Soft-delete: user deletion sets `deletedAt`, revokes sessions, and overwrites `email` (frees it for reuse) instead of a hard delete; sign-in is blocked for soft-deleted users.
- Migrations: `bunx prisma migrate dev` needs an interactive TTY — it fails under a non-interactive shell (e.g. an agent's Bash tool). For scripted migration work, hand-write the migration folder/SQL and apply with `bunx prisma migrate deploy`, or have the user run `migrate dev` themselves.
- Validation: `lib/validate.ts`'s `validateBody(schema, req, res)` is the shared `safeParse` → 400-response pattern used by every route with a Zod-validated body; it writes the 400 itself and returns `undefined` on failure, so callers just do `if (!data) return;`.
- Error handling: route handlers don't use try/catch — Express 5 auto-forwards a rejected promise to error middleware. `middleware/error-handler.ts` (registered last) maps `P2002` → 409, `P2025` → 404, plus a generic 500 fallback — Prisma error responses are deliberately generic rather than resource-specific.
- Tickets and replies live in one file, `routes/tickets.ts` (`/api/tickets`): `?category=uncategorized` is a sentinel for "category is null" since a query string can't carry a real `null`. `Ticket.status` is a five-value state machine — `new` → `processing` → `resolved`/`open` — where `new`/`processing` are internal-only to the auto-resolve pipeline and must never reach a human; `GET /` unconditionally intersects `where.status` with the three human-visible statuses regardless of `?status=`. Auto-resolution and classification run async off the inbound-email webhook via pg-boss jobs (`jobs/auto-resolve-ticket-job.ts`, `jobs/classify-ticket-job.ts`); auto-resolve is wrapped in try/catch and always falls back to `open` on any failure (empty KB, Pinecone/OpenAI error) so a ticket can never get stuck hidden in `processing`. An AI-authored reply uses a synthetic bot `User` (`lib/tickets/ai-assistant-user.ts`'s `getAiAssistantUser()` — lookup only, never find-or-create; the row is seeded once) with `role: Role.ai`, which can't sign in or be deleted. `TicketReply.senderType` also has a `customer` value, backed by a real `User` row (`role: Role.customer`, no `Account` row, blocked from sign-in by the same `lib/auth.ts` hook that blocks `Role.ai`) so a customer-authored reply has a correctly-attributed author — today only `prisma/scripts/seed-tickets.ts` creates these. `routes/users.ts`'s `GET /` excludes both `Role.ai` and `Role.customer` from the admin Users listing (`role: { notIn: [...] }`) since neither is real staff; `routes/users.ts`'s delete guard, however, only blocks deleting `Role.admin`/`Role.ai` — a `Role.customer` row is still deletable via a direct `DELETE /api/users/:id` call (just not discoverable through the UI list anymore).
- Both inbound-email and reply bodies accept an optional `bodyHtml`, always run through `lib/sanitize-html.ts` (DOMPurify + jsdom) before storage, so it's safe to render with `dangerouslySetInnerHTML` on the client.
- `packages/client`: Vite + React 19, shadcn/ui + Tailwind v4. `authClient`'s `inferAdditionalFields` plugin must stay in sync with the server's `user.additionalFields`. `@tanstack/react-table` is pinned to `^8.21.3` — its `9.x` line is an incompatible from-scratch rewrite; don't let a routine bump pull it back in.
- `DataTable` (`components/data-table.tsx`): pagination and column-filtering are each *either* server-controlled (pass the state + change-handler pair) or left to an internal fallback (omit them); sorting is fully on (pass both `sorting`/`onSortingChange`) or fully off.
- Rich text: `components/ui/rich-text-editor.tsx` wraps Quill directly (not `react-quill`, unmaintained/React-19-incompatible). It's mounted imperatively in a `useEffect`; the cleanup **must** operate on the `container` captured in the effect's own closure, not re-read `containerRef.current` — by cleanup time (e.g. StrictMode's double-invoke) the ref can already be `null`, silently no-op-ing the teardown and leaving a duplicate editor in the DOM.
- `moment` is used for client-side date formatting rather than native `Intl`/`Date` — intentional, not something to "simplify" away.
- Formatting is enforced via Prettier (`singleQuote`, `tabWidth: 3`, `printWidth: 80`) and lint-staged/husky on commit; there is no shared ESLint config at the root — only `packages/client` has one.
