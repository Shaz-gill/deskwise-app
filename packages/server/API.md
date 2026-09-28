# Deskwise API — curl reference

Every endpoint the server exposes, with a working `curl` example for each. Run the server first (`bun run dev` or `bun run start` from `packages/server`, or `bun run dev` from the repo root) and adjust `BASE_URL`/credentials/IDs to match your local data.

Most routes require a signed-in session. Better Auth issues an `httpOnly` cookie on sign-in, so the pattern throughout is: sign in once with a cookie jar (`-c cookies.txt`), then pass that jar (`-b cookies.txt`) on every authenticated request.

```bash
BASE_URL=http://localhost:3000
```

## Setup — signing in

Uses the demo admin from `bun run seed:users` (`shaz.gill@deskwise.dev` / `Password123!`); swap in real credentials otherwise. Admin-only endpoints below need an admin session — sign in with a non-admin demo agent instead to see a 403.

```bash
curl -s -c cookies.txt -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "shaz.gill@deskwise.dev",
    "password": "Password123!"
  }'
```

## Auth (`/api/auth/*`)

Mounted from [Better Auth](https://www.better-auth.com) (`lib/auth.ts`), which generates many more endpoints than are listed here — these three are the only ones the client actually calls (`lib/auth-client.ts`). Public sign-up is disabled (`disableSignUp: true`); accounts are created via `POST /api/users` below. Credential paths are rate-limited by `authLimiter` (20 req / 15 min).

Better Auth validates the request's `Origin` header independently of Express's own CORS layer, for state-changing requests on an already-authenticated session (e.g. sign-out) — a real browser sends this automatically, but `curl` doesn't, so it must be passed explicitly and must match `TRUSTED_ORIGINS` (`http://localhost:*` by default; any `http://localhost:<port>` works). Sign-in itself doesn't require it.

### Sign in

```bash
curl -s -c cookies.txt -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "shaz.gill@deskwise.dev",
    "password": "Password123!"
  }'
```

### Get current session

```bash
curl -s -b cookies.txt "$BASE_URL/api/auth/get-session"
```

### Sign out

```bash
curl -s -b cookies.txt -X POST "$BASE_URL/api/auth/sign-out" \
  -H "Origin: http://localhost:5173"
```

## Users (`/api/users`)

All routes except `/assignable` require an admin session (`requireAuth` + `requireAdmin`).

### List users (paginated, searchable, admin-only)

```bash
curl -s -b cookies.txt "$BASE_URL/api/users?search=&page=1&pageSize=15"
```

### List assignable users (any authenticated user)

Backs the assignee picker on a ticket — deliberately not admin-gated, since ticket assignment itself isn't either.

```bash
curl -s -b cookies.txt "$BASE_URL/api/users/assignable"
```

### Create a user (admin-only)

```bash
curl -s -b cookies.txt -X POST "$BASE_URL/api/users" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jamie Rivera",
    "email": "jamie.rivera@deskwise.dev",
    "password": "Password123!"
  }'
```

### Update a user (admin-only)

`password` is optional — omit it (or send `""`) to leave the password unchanged.

```bash
curl -s -b cookies.txt -X PATCH "$BASE_URL/api/users/<user-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jamie Rivera",
    "email": "jamie.rivera@deskwise.dev",
    "password": ""
  }'
```

### Delete (soft-delete) a user (admin-only)

Admin accounts are protected and return `403`.

```bash
curl -s -b cookies.txt -X DELETE "$BASE_URL/api/users/<user-id>"
```

## Tickets (`/api/tickets`)

All routes require a signed-in session except the inbound-email webhook, which instead requires the `x-webhook-secret` header.

### List tickets (paginated, sortable, filterable)

`status`/`category` filters accept only human-facing values (`open`/`resolved`/`closed`; `category` also accepts the `uncategorized` sentinel for "category is null") — the internal `new`/`processing` auto-resolve states are never returned here, no matter what's passed.

```bash
curl -s -b cookies.txt "$BASE_URL/api/tickets?sortBy=createdAt&sortOrder=desc&status=open&category=&subject=&page=1&pageSize=15"
```

### Get a single ticket (with its replies)

```bash
curl -s -b cookies.txt "$BASE_URL/api/tickets/<ticket-id>"
```

### Update a ticket (assignee / status / category)

`status` only accepts `open`, `resolved`, or `closed` — the auto-resolve pipeline's internal `new`/`processing` states are rejected with a `400`.

```bash
curl -s -b cookies.txt -X PATCH "$BASE_URL/api/tickets/<ticket-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "assignedToId": null,
    "status": "resolved",
    "category": "general_question"
  }'
```

### Add a reply to a ticket

```bash
curl -s -b cookies.txt -X POST "$BASE_URL/api/tickets/<ticket-id>/replies" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "Thanks for reaching out — here is an update on your order.",
    "bodyHtml": "<p>Thanks for reaching out — here is an update on your order.</p>"
  }'
```

### Polish a draft reply with AI

Behind `polishLimiter` (20 req / 15 min). Improves grammar/clarity/tone while preserving the agent's own wording — does not add a greeting/sign-off.

```bash
curl -s -b cookies.txt -X POST "$BASE_URL/api/tickets/<ticket-id>/replies/polish" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "hey so your order shipped already should be there in a few days sorry for the wait"
  }'
```

### Summarize a ticket with AI

Behind `summarizeLimiter` (20 req / 15 min). Summarizes the subject/body/reply thread — no request body.

```bash
curl -s -b cookies.txt -X POST "$BASE_URL/api/tickets/<ticket-id>/summarize"
```

### Inbound-email webhook (no session — webhook secret instead)

Behind `inboundEmailLimiter` (50 req / 15 min) and a timing-safe `x-webhook-secret` check against `WEBHOOK_SECRET`. Creates a new ticket (which immediately kicks off async classification and knowledge-base auto-resolution — see the root `README.md`'s "How the RAG pipeline works"), or reuses an existing *open* ticket for the same sender + subject instead of creating a duplicate.

```bash
curl -s -X POST "$BASE_URL/api/tickets/inbound-email" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d '{
    "from": "customer@example.com",
    "fromName": "Alex Chen",
    "subject": "How long does shipping take?",
    "body": "How many days do I have to return an item?",
    "bodyHtml": "<p>How many days do I have to return an item?</p>"
  }'
```

## Knowledge Base (`/api/knowledge-docs`)

All routes require an admin session (`requireAuth` + `requireAdmin`) — this is the RAG document store that powers both ticket auto-resolution and (in future) other grounded AI replies.

### List knowledge base documents

```bash
curl -s -b cookies.txt "$BASE_URL/api/knowledge-docs"
```

### Upload a document

Behind `knowledgeUploadLimiter` (10 req / 15 min). Multipart upload, field name `file`; only `.pdf`/`.docx`/`.txt`/`.md` are accepted (checked by extension, not the browser-supplied content type), max 20MB. Returns immediately — extraction/chunking/embedding/upsert into Pinecone happens asynchronously.

```bash
curl -s -b cookies.txt -X POST "$BASE_URL/api/knowledge-docs" \
  -F "file=@/path/to/shipping-policy.pdf"
```

### View/download the original uploaded file

```bash
curl -s -b cookies.txt "$BASE_URL/api/knowledge-docs/<doc-id>/file" -o downloaded-file
```

### Delete a document

Removes its Pinecone vectors and the file on disk (best-effort) before deleting the `KnowledgeDoc` row.

```bash
curl -s -b cookies.txt -X DELETE "$BASE_URL/api/knowledge-docs/<doc-id>"
```
