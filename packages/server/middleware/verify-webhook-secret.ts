import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

// Shared-secret check for POST /api/tickets/inbound-email. Compares the
// x-webhook-secret header against WEBHOOK_SECRET using a timing-safe
// comparison (crypto.timingSafeEqual) so a caller can't infer the secret
// byte-by-byte from response-time differences — a plain `===` would leak
// timing info proportional to how many leading bytes match.
// timingSafeEqual throws if the two buffers have different lengths, so the
// length check must happen first.
export function verifyWebhookSecret(
   req: Request,
   res: Response,
   next: NextFunction
) {
   const provided = req.header('x-webhook-secret');
   const expected = process.env.WEBHOOK_SECRET;

   if (
      !provided ||
      !expected ||
      provided.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
   ) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
   }

   next();
}
