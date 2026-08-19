# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Deskwise: an AI-powered support ticket management system (see `docs/project-scope.md`). Support emails become tickets that are auto-classified, summarized, and given AI-suggested replies via the Claude API, with a dashboard for agents/admins to manage them.

`packages/server` has Prisma and Better Auth wired up end-to-end: the Better Auth handler is mounted at `/api/auth`, `cors` and `helmet` are both applied, and there's a `requireAuth` middleware plus a `GET /api/me` route as the first protected endpoint. `packages/client` has grown a working auth flow on top of the Vite template: shadcn/ui (Tailwind v4, `base-nova` style, `@base-ui/react` primitives) plus `react-router-dom` route guards (`ProtectedRoute`, `GuestRoute`, `AdminRoute`) gating a `/login` page (react-hook-form + zod), a `/` home page, and a placeholder admin-only `/users` page — all wrapped in a shared `Layout`/`NavBar`. Beyond auth and this routing shell, none of the product features in `docs/project-scope.md` (tickets, AI classification, email ingestion) are implemented yet — `UsersPage` is still just a heading, not real user management. `docs/implementation-plan.md` has the intended build order (auth → user management → ticket CRUD → AI features → email → dashboard), and `docs/tech-stack.md` has the intended stack (Postgres + Prisma, session auth, SendGrid/Mailgun, Claude API). Check these docs for intent before assuming current code reflects the target design — e.g. `packages/server/.env.example` used to reference `OPENAI_API_KEY` even though the tech stack doc specifies Claude/Anthropic (now replaced by `DATABASE_URL`/`BETTER_AUTH_SECRET`).

`docs/` (root) describes the product: scope, tech stack, and implementation plan. There are no longer per-package setup docs under `packages/server/docs/` or `packages/client/docs/` (removed as unnecessary) — for Prisma/Better Auth/shadcn setup details, refer to the actual config (`packages/server/lib/auth.ts`, `packages/server/prisma/schema.prisma`, `packages/client/components.json`) or the tools' own docs.

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
- Auth: Better Auth (`packages/server/lib/auth.ts`), configured with the Prisma adapter and email/password sign-in with `disableSignUp: true` (users are pre-provisioned, not self-registered — matches the admin-creates-agents model in `docs/project-scope.md`). `trustedOrigins` is wired from the `TRUSTED_ORIGINS` env var (`.env` has `http://localhost:*` for dev) — without it, any authenticated POST from the browser (sign-out, etc.) gets rejected with a 403 `Invalid Origin`, since Better Auth's origin check is separate from Express's `cors()`. `user.additionalFields.role` exposes the `role` column (see below) on the session/`get-session` user object — Better Auth silently drops fields it doesn't know about, so this must stay declared here (and mirrored client-side, see below) for `role` to ever reach the client. Its `User`/`Session`/`Account`/`Verification` models live in the same `schema.prisma` as the rest of the app's data; `User.role` is a `Role` enum (`admin` | `agent`, default `agent`) added for the admin-vs-agent model. Mounted in `index.ts` at `/api/auth` via `toNodeHandler(auth)`, registered *before* `express.json()`. Route protection is done with `packages/server/middleware/require-auth.ts` (`requireAuth`), which calls `auth.api.getSession` and attaches `req.user`/`req.session` — typed via the global augmentation in `packages/server/express.d.ts`. `packages/server/middleware/auth-limiter.ts` defines an `authLimiter` (`express-rate-limit`, 20 req/15min) scoped to credential-related paths (`/sign-in`, `/sign-up`, `/change-password`, `/change-email`) — as of this writing it exists but is not yet mounted in `index.ts`.
- `packages/client`: Vite + React 19 + TypeScript, shadcn/ui + Tailwind v4. `src/lib/auth-client.ts` creates the Better Auth React client (`authClient`, from `better-auth/react`) with an `inferAdditionalFields` plugin declaring `role` — this must stay in sync with `user.additionalFields` in `packages/server/lib/auth.ts` or `session.user.role` silently comes back `undefined`. Routing is `react-router-dom`, wired in `main.tsx` (`BrowserRouter`) and `App.tsx` (route table): route guards live under `src/components/routes/` — `ProtectedRoute` gates `/` on a session, `GuestRoute` gates `/login` on the *absence* of one, and `AdminRoute` further gates `/users` on `role === 'admin'` — all three read `authClient.useSession()` directly rather than passing user/session down as props. `Layout` + `NavBar` provide the shared authenticated app shell.
- Formatting is enforced via Prettier (`singleQuote`, `tabWidth: 3`, `printWidth: 80`) and lint-staged/husky on commit; there is no shared ESLint config at the root — only `packages/client` has one.
