# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Deskwise: an AI-powered support ticket management system (see `docs/project-scope.md`). Support emails become tickets that are auto-classified, summarized, and given AI-suggested replies via the Claude API, with a dashboard for agents/admins to manage them.

Auth, user management, and ticket CRUD (list/detail/reply, assignment, status/category updates, inbound-email webhook intake) are built end-to-end — see Architecture below. AI classification/summarization/suggested-replies (Claude API), real email-provider ingestion (SendGrid/Mailgun — today there's only a generic secret-gated JSON webhook, not a provider-specific parser), and the dashboard are not implemented yet (`/` renders a placeholder `HomePage`). `docs/implementation-plan.md` has the intended build order (auth → user management → ticket CRUD → AI features → email → dashboard), and `docs/tech-stack.md` has the intended stack (Postgres + Prisma, session auth, SendGrid/Mailgun, Claude API). Check these docs for intent before assuming current code reflects the target design.

`docs/` (root) covers product scope/stack/plan. There are no per-package setup docs under `packages/server/docs/` or `packages/client/docs/` (removed as unnecessary) — for Prisma/Better Auth/shadcn setup, use the tools' own docs or read the actual config.

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
- Seed the initial admin user: `bun run seed`. Seed sample tickets/replies for local testing: `bun run seed:tickets`

Client (`packages/client`):

- Dev server: `bun run dev`
- Build: `bun run build` (`tsc -b && vite build`)
- Lint: `bun run lint`
- Preview production build: `bun run preview`

No test framework is configured in either package yet.

A husky `pre-commit` hook runs `lint-staged`, which runs `prettier --write` on staged `*.{js,jsx,ts,tsx,css}` files.

## Git

- Never run `git commit`, `git push`, or any command that creates commits or modifies remotes (including amend, rebase, merge, tag, or force operations).
- Leave all changes uncommitted in the working tree for review.
- Only commit or push if explicitly asked in that session; pushes go straight to `origin/master` — no branch/PR flow, since this is a solo project.

## Architecture

- Bun workspaces: root `package.json` declares `packages/*` as workspaces; `server` and `client` are independent, tied together only by the root `index.ts` dev orchestrator.
- `packages/server`: Express 5 + TypeScript, ESM (`"type": "module"`), loads env vars via `dotenv`. Entry point `packages/server/index.ts`.
- Database: Prisma with the `@prisma/adapter-pg` driver adapter over `pg`/PostgreSQL. Schema at `packages/server/prisma/schema.prisma`; the generated client outputs to `packages/server/generated/prisma` (not the default `node_modules/@prisma/client` location) and is re-exported as a singleton from `packages/server/db.ts`.
- Auth: Better Auth (`packages/server/lib/auth.ts`) — email/password with `disableSignUp: true` (users are pre-provisioned — matches the admin-creates-agents model in `docs/project-scope.md`). `trustedOrigins` comes from `packages/server/lib/trusted-origins.ts` (shared with the global `cors()` origin check in `index.ts`, both sourced from `TRUSTED_ORIGINS`) — without it, authenticated POSTs (sign-out, etc.) get rejected with a 403 `Invalid Origin`, since Better Auth's origin check is separate from Express's `cors()`. `user.additionalFields.role` must stay declared here (and mirrored in `packages/client/src/lib/auth-client.ts`) or Better Auth silently drops it and `session.user.role` comes back `undefined`. The handler is mounted at `/api/auth` and must be registered _before_ `express.json()`. `requireAuth` (`middleware/require-auth.ts`) attaches `req.user`/`req.session`; `requireAdmin` (`middleware/require-admin.ts`) checks `req.user.role === Role.admin` with no null check, so it must always run after `requireAuth`. `middleware/auth-limiter.ts` rate-limits credential paths (20 req/15min) ahead of the Better Auth handler. Soft-delete: `/api/users`'s delete route sets `User.deletedAt`, revokes sessions, and overwrites `email` to `` `deleted+${userId}@deskwise.invalid` `` instead of a hard delete — frees the original email for reuse (since `email` is globally `@@unique`) while keeping the row around for future ticket-history references; `auth.ts`'s `hooks.before` blocks sign-in for any soft-deleted user with a `FORBIDDEN` `APIError`.
- Migrations: `bunx prisma migrate dev` needs an interactive TTY — it fails under a non-interactive shell (e.g. an agent's Bash tool) with "environment is non-interactive". For scripted migration work, hand-write the migration folder/SQL and apply with `bunx prisma migrate deploy` instead, or have the user run `migrate dev` themselves.
- `packages/server/lib/validate.ts`'s `validateBody(schema, req, res)` is the shared `safeParse` → 400-response pattern used by every route with a Zod-validated body (`routes/users.ts`'s POST/PATCH, `routes/tickets.ts`'s PATCH and inbound-email webhook, `routes/ticket-replies.ts`'s POST); it writes the 400 itself and returns `undefined` on failure, so callers just do `if (!data) return;`. `zod` is a direct dependency of `packages/server` for this (not just transitively via `core`).
- Error handling: route handlers don't use try/catch — Express 5 auto-forwards a rejected promise from an async handler to error-handling middleware. `middleware/error-handler.ts` is registered last in `index.ts` (must come after all routes) and is the single place that maps `Prisma.PrismaClientKnownRequestError` codes to HTTP responses (`P2002` unique-constraint violation → 409, `P2025` record-not-found → 404) plus a generic 500 fallback with `console.error` logging. This means Prisma error responses are now generic ("A record with this value already exists" / "Not found") rather than resource-specific — a deliberate tradeoff for consistency as more routes get added, not an oversight.
- Tickets (`routes/tickets.ts`, mounted at `/api/tickets`): `GET /` (paginated, sortable, filterable by subject/status/category — `?category=uncategorized` is a sentinel for "category is null", since a query string can't carry a real `null`), `GET /:id` (includes replies via `TICKET_SELECT` + `TICKET_REPLY_SELECT`, the latter imported from `routes/ticket-replies.ts`), `PATCH /:id` (assignee/status/category), and `POST /inbound-email` — a webhook behind `middleware/inbound-email-limiter.ts` (50 req/15min) and `middleware/verify-webhook-secret.ts` (timing-safe compare of the `x-webhook-secret` header against `WEBHOOK_SECRET`), which reuses an existing _open_ ticket for the same sender+subject instead of creating a duplicate. Replies: `routes/ticket-replies.ts`, mounted at `/api/tickets/:ticketId/replies` (`Router({ mergeParams: true })` to read `ticketId`), `POST /` only.
- Both inbound-email and reply bodies accept an optional `bodyHtml` alongside the required plain-text `body`; `bodyHtml` is always run through `lib/sanitize-html.ts` (DOMPurify + jsdom) before being stored, so it's safe to render with `dangerouslySetInnerHTML` on the client. `jsdom` ships no types, so `@types/jsdom` is a required devDependency in `packages/server` even though nothing imports it directly. `routes/users.ts`'s `GET /assignable` (unpaginated, `requireAuth` only — not admin-gated, since ticket assignment itself isn't) backs the assignee picker in `components/tickets/TicketDetailsPanel.tsx`.
- `packages/core` (`src/schemas.ts`) holds shared Zod schemas (`loginSchema`, `createUserSchema`, `editUserSchema`, `inboundEmailSchema`, `updateTicketSchema`, `createTicketReplySchema`), consumed by both `packages/server` and `packages/client` as the package `core` (`"core": "workspace:*"`, symlinked by `bun install`). Cross-package imports must use the package name (`from 'core'`), not a relative path (`../../core`) — a relative import type-checks fine under TS's `bundler` resolution but fails at runtime under Bun, which doesn't apply `package.json` `exports` to relative paths. `core` also exports plain const-object "enums" (not real TS `enum`s, since `packages/client`'s `erasableSyntaxOnly` tsconfig option forbids those): `src/role.ts`'s `Role` and `src/ticket-reply-sender-type.ts`'s `TicketReplySenderType` use lowercase keys matching their values (`{ admin: 'admin', user: 'user' }`, `{ user: 'user', customer: 'customer' }` — both mirror their Prisma enum exactly), while `src/ticket-status.ts` and `src/ticket-category.ts` use PascalCase keys instead (`TicketStatus.Open === 'open'`) — the two naming conventions coexist, so check the actual file rather than assuming one style. **Always compare against these exports (`Role.admin`, `TicketStatus.Open`, etc.) instead of raw string literals** — this is what `packages/client`'s route guards (`AdminRoute`) and role checks (`NavBar`, `UserRowActions`) already do. Server-side, prefer Prisma's own generated enums (`packages/server/generated/prisma/enums`, already used in `routes/users.ts`, `routes/tickets.ts`, `middleware/require-admin.ts`, and `lib/auth.ts`) over `core`'s. Note `TicketReplySenderType` alone can't distinguish an admin's reply from a regular user's (both are stored as `senderType: 'user'`) — `lib/ticket-format.ts`'s `getReplySenderInfo(senderType, authorRole)` combines it with the reply author's `Role` to pick the right label/icon/badge in `components/tickets/TicketReplies.tsx`.
- `packages/client`: Vite + React 19, shadcn/ui + Tailwind v4. `authClient`'s `inferAdditionalFields` plugin (`lib/auth-client.ts`) must stay in sync with the server's `user.additionalFields` or `session.user.role` comes back `undefined`. Route guards (`ProtectedRoute`/`GuestRoute`/`AdminRoute`, under `components/routes/`) read `authClient.useSession()` directly. `main.tsx` wraps the tree in a `QueryClientProvider` for server-state fetching. `@tanstack/react-table` is pinned to `^8.21.3` — its `9.x` line is a from-scratch API rewrite incompatible with `components/data-table.tsx`'s classic-v8 shadcn `DataTable` pattern; don't let a routine dependency bump silently pull v9 back in. `hooks/use-debounced-value.ts`'s `useDebouncedValue` backs the search/filter inputs on both `UsersPage.tsx` and `TicketsPage.tsx`. `components/ui/skeletons.tsx` holds the app's loading placeholders: `TableSkeleton` (configurable `header`/`columns`/`rowCount`, used by both table pages) and `TicketDetailSkeleton` (the two-card ticket-detail loading layout).
- `DataTable` (`components/data-table.tsx`) is a generalized TanStack v8 wrapper: pagination and column-filtering are each _either_ server-controlled (pass the state + change-handler pair, e.g. `pagination`/`onPaginationChange`/`pageCount`, `columnFilters`/`onColumnFiltersChange`) or left to an internal `useState` fallback (omit them); sorting is fully on (pass `sorting`/`onSortingChange` together, enabling `manualSorting`) or fully off (omit both). `facetedFilters` renders single-select dropdown filters next to the search input. Both `UsersPage.tsx` (server-controlled filtering/pagination, no sorting/facets) and `TicketsPage.tsx` (full server-controlled/sortable/faceted mode) are on this API — don't reintroduce the older `total`/`onSearchChange`/`searchPlaceholder` props, which no longer exist on `DataTableProps`.
- Rich text: `components/ui/rich-text-editor.tsx` wraps Quill directly (BSD-3, free, ships its own toolbar UI) — not the `react-quill` npm package, which is unmaintained and incompatible with React 19. It's uncontrolled and mounted imperatively inside a `useEffect`; the cleanup **must** operate on the `container` element captured in the effect's own closure, not re-read `containerRef.current` — by cleanup time (e.g. React StrictMode's dev-only double-invoke of effects) the ref can already read as `null`/`undefined`, which makes an optional-chained `containerRef.current?.foo()` silently no-op and leaves a duplicate toolbar/editor stacked in the DOM. Quill's own stylesheet (`quill/dist/quill.snow.css`) hardcodes icon/placeholder colors for a light background, a blue (`#06c`) active/hover accent that clashes with the app's teal primary, and zero margin on `p`/`ol`/`ul` — both the editor's own Tailwind overrides and `components/tickets/TicketReplies.tsx`'s read-only rendering of stored `bodyHtml` (which reuses the `.ql-editor` class for its list/typography rules) need `!important` to reliably beat that vendor stylesheet, since plain-specificity utilities like `space-y-*` lose that fight regardless of CSS load order.
- `moment` is used for date formatting on the client (`TicketDetail.tsx`, `TicketReplies.tsx`, `TicketsPage.tsx`, `UsersPage.tsx`) rather than the native `Intl`/`Date` APIs — an intentional dependency, not something to "simplify" away.
- Formatting is enforced via Prettier (`singleQuote`, `tabWidth: 3`, `printWidth: 80`) and lint-staged/husky on commit; there is no shared ESLint config at the root — only `packages/client` has one.
