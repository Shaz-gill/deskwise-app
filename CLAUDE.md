# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Deskwise: an AI-powered support ticket management system (see `docs/project-scope.md`). Support emails become tickets that are auto-classified, summarized, and given AI-suggested replies via the Claude API, with a dashboard for agents/admins to manage them.

The repo is currently a bare scaffold — `packages/server` is a single-route Express hello-world and `packages/client` is the unmodified Vite React template. None of the features in `docs/project-scope.md` (auth, tickets, AI classification, email ingestion) are implemented yet. `docs/implementation-plan.md` has the intended build order (auth → user management → ticket CRUD → AI features → email → dashboard), and `docs/tech-stack.md` has the intended stack (Postgres + Prisma, session auth, SendGrid/Mailgun, Claude API). Check these docs for intent before assuming current code reflects the target design — e.g. `packages/server/.env.example` still has `OPENAI_API_KEY` even though the tech stack doc specifies Claude/Anthropic.

## Commands

This is a Bun workspace monorepo (`packages/*`). Run commands from the repo root unless noted.

- Install deps: `bun install`
- Run both server and client in dev mode: `bun run dev` (runs `index.ts`, which uses `concurrently` to run `bun run dev` in both `packages/server` and `packages/client`)
- Format all files: `bun run format` (prettier --write .)

Server (`packages/server`):
- Dev (watch mode): `bun run dev`
- Start without watch: `bun run start`

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
- `packages/client`: Vite + React 19 + TypeScript. Standard Vite template structure (`src/App.tsx`, `src/main.tsx`). `react-router` is listed in the intended tech stack but not yet added as a dependency.
- Formatting is enforced via Prettier (`singleQuote`, `tabWidth: 3`, `printWidth: 80`) and lint-staged/husky on commit; there is no shared ESLint config at the root — only `packages/client` has one.
