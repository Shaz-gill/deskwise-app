import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth';
import { authLimiter } from './middleware/rate-limiters';
import { errorHandler } from './middleware/error-handler';
import { isTrustedOrigin } from './lib/trusted-origins';
import { usersRouter } from './routes/users';
import { ticketsRouter } from './routes/tickets';

dotenv.config();

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

app.use(errorHandler);

app.listen(port, () => {
   console.log(`Server is running on http://localhost:${port}`);
});
