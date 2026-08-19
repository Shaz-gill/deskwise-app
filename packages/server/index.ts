import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth';
import { requireAuth } from './middleware/require-auth';
import { authLimiter } from './middleware/auth-limiter';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(helmet());

// Better Auth handler — must be registered before express.json()
app.all(
   '/api/auth/{*any}',
   authLimiter,
   (req: Request, res: Response, next) => {
      toNodeHandler(auth)(req, res).catch(next);
   }
);

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
   res.send('Hello World!');
});

app.get('/api/hello', (req: Request, res: Response) => {
   res.json({ message: 'Hello World!' });
});

app.get('/api/me', requireAuth, (req: Request, res: Response) => {
   res.json({
      user: req.user,
      session: req.session,
   });
});

app.listen(port, () => {
   console.log(`Server is running on http://localhost:${port}`);
});
