import type { ErrorRequestHandler } from 'express';
import { Prisma } from '../generated/prisma/client';

// Express 5 auto-forwards a rejected promise from an async handler here, so
// route handlers don't need their own try/catch — this is the one place
// that turns known Prisma errors into the right HTTP response.
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
   if (err instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002 = unique constraint violation (e.g. User.email is @unique).
      if (err.code === 'P2002') {
         res.status(409).json({
            error: 'A record with this value already exists',
         });
         return;
      }

      // P2025 = the row a query expected to find/update/delete doesn't exist.
      if (err.code === 'P2025') {
         res.status(404).json({ error: 'Not found' });
         return;
      }
   }

   console.error(`Unhandled error on ${req.method} ${req.path}:`, err);
   res.status(500).json({ error: 'Internal Server Error' });
};
