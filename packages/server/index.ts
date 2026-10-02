import dotenv from 'dotenv';
dotenv.config();

// Must be imported before anything else so Sentry can instrument modules
// required afterwards.
import { Sentry } from './lib/sentry';

import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth';
import { authLimiter } from './middleware/rate-limiters';
import { errorHandler } from './middleware/error-handler';
import { isTrustedOrigin } from './lib/trusted-origins';
import { usersRouter } from './routes/users';
import { ticketsRouter } from './routes/tickets';
import { knowledgeDocsRouter } from './routes/knowledge-docs';
import { startQueue } from './lib/queue';
import { ensureKnowledgeBaseDir } from './lib/knowledge-base/path';
import { registerClassifyTicketWorker } from './jobs/classify-ticket-job';
import { registerAutoResolveTicketWorker } from './jobs/auto-resolve-ticket-job';
import { registerIngestDocumentWorker } from './jobs/ingest-document-job';
import { registerSendReplyEmailWorker } from './jobs/send-reply-email-job';

const app = express();
const port = process.env.PORT || 3000;

// ── Global middleware ────────────────────────────────────────────────────
app.use(helmet());
app.use(
   cors({
      origin(origin, callback) {
         // No Origin header (same-origin requests, curl, server-to-server)
         // — nothing to check against.
         if (!origin || isTrustedOrigin(origin)) {
            callback(null, true);
            return;
         }
         callback(new Error('Not allowed by CORS'));
      },
   })
);

// ALL /api/auth/* (authLimiter — no requireAuth, since this *is* the
// sign-in/sign-up/sign-out/session endpoint group Better Auth generates).
// Must be mounted BEFORE express.json() — it reads the raw request body
// itself, so express.json() would otherwise consume the stream first and
// leave nothing for it to parse.
app.all(
   '/api/auth/{*any}',
   authLimiter,
   (req: Request, res: Response, next) => {
      toNodeHandler(auth)(req, res).catch(next);
   }
);

app.use(express.json());

app.use('/api/users', usersRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/knowledge-docs', knowledgeDocsRouter);

// pg-boss needs boss.start() before any send()/work() call, and each
// worker needs to be registered once — both run here, in order, before the
// server starts accepting traffic.
await startQueue();
await registerClassifyTicketWorker();
await registerAutoResolveTicketWorker();
await registerIngestDocumentWorker();
await registerSendReplyEmailWorker();

// Uploaded knowledge base files are saved here (see routes/knowledge-docs.ts)
await ensureKnowledgeBaseDir();

// Reports errors from route handlers to Sentry; must come after all
// routes and before our own errorHandler, which still owns the response.
Sentry.setupExpressErrorHandler(app);

app.use(errorHandler);

app.listen(port, () => {
   console.log(`Server is running on http://localhost:${port}`);
});
