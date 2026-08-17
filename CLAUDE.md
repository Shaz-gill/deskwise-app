# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Deskwise: an AI-powered support ticket management system (see `docs/project-scope.md`). Support emails become tickets that are auto-classified, summarized, and given AI-suggested replies via the Claude API, with a dashboard for agents/admins to manage them.

`packages/client` is still the unmodified Vite React template. `packages/server` has Prisma and Better Auth wired up end-to-end: the Better Auth handler is mounted at `/api/auth`, `cors` is applied, and there's a `requireAuth` middleware plus a `GET /api/me` route as the first protected endpoint. `helmet` is installed but not yet applied in `index.ts`. Beyond that, none of the product features in `docs/project-scope.md` (tickets, AI classification, email ingestion) are implemented yet. `docs/implementation-plan.md` has the intended build order (auth → user management → ticket CRUD → AI features → email → dashboard), and `docs/tech-stack.md` has the intended stack (Postgres + Prisma, session auth, SendGrid/Mailgun, Claude API). Check these docs for intent before assuming current code reflects the target design — e.g. `packages/server/.env.example` used to reference `OPENAI_API_KEY` even though the tech stack doc specifies Claude/Anthropic (now replaced by `DATABASE_URL`/`BETTER_AUTH_SECRET`).

There are two `docs/` directories: root `docs/` describes the product (scope, tech stack, implementation plan); `packages/server/docs/` has step-by-step setup notes for how specific server-side tooling was integrated (`prisma-setup.md`, `better-auth-setup.md`) — read these before touching the Prisma schema or Better Auth config, since they document the exact CLI commands (`bunx prisma migrate dev`, `bunx @better-auth/cli generate`) needed to keep schema/migrations/generated client in sync after a change. `packages/server/docs/better-auth-endpoints.md` lists every Better Auth route this config actually exposes, and which of them (password reset, email verification, social sign-in) are registered but non-functional until further config is added.

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

- Bun workspaces: root `package.json` declares `packages/*` as workspaces; the two packages (`server`, `client`) are independent and only tied together by the root `index.ts` dev orchestrator.
- `packages/server`: Express 5 + TypeScript, ESM (`"type": "module"`), loads env vars via `dotenv`. Entry point is `packages/server/index.ts`.
- Database: Prisma with the `@prisma/adapter-pg` driver adapter over `pg`/PostgreSQL. Schema is `packages/server/prisma/schema.prisma`; the generated client outputs to `packages/server/generated/prisma` (not the default `node_modules/@prisma/client` location) and is re-exported as a singleton from `packages/server/db.ts`.
- Auth: Better Auth (`packages/server/lib/auth.ts`), configured with the Prisma adapter and email/password sign-in with `disableSignUp: true` (users are pre-provisioned, not self-registered — matches the admin-creates-agents model in `docs/project-scope.md`). Its `User`/`Session`/`Account`/`Verification` models live in the same `schema.prisma` as the rest of the app's data. Mounted in `index.ts` at `/api/auth` via `toNodeHandler(auth)`, registered *before* `express.json()`. Route protection is done with `packages/server/middleware/require-auth.ts` (`requireAuth`), which calls `auth.api.getSession` and attaches `req.user`/`req.session` — typed via the global augmentation in `packages/server/express.d.ts`. See `packages/server/docs/better-auth-endpoints.md` for the full endpoint list.
- `packages/client`: Vite + React 19 + TypeScript. Standard Vite template structure (`src/App.tsx`, `src/main.tsx`). `react-router` is listed in the intended tech stack but not yet added as a dependency.
- Formatting is enforced via Prettier (`singleQuote`, `tabWidth: 3`, `printWidth: 80`) and lint-staged/husky on commit; there is no shared ESLint config at the root — only `packages/client` has one.
