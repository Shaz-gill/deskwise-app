import type { Request, Response } from 'express';
import type { ZodType } from 'zod';

// Shared safeParse -> 400 pattern used by every route with a zod-validated
// body (POST/PATCH /api/users). Sends the 400 response itself and returns
// undefined on failure, so callers only need `if (!data) return;` before
// using the parsed data.
export function validateBody<T>(
   schema: ZodType<T>,
   req: Request,
   res: Response
): T | undefined {
   const result = schema.safeParse(req.body);
   if (!result.success) {
      res.status(400).json({
         error: 'Validation failed',
         issues: result.error.issues,
      });
      return undefined;
   }

   return result.data;
}

// Shared numeric-route-param parsing pattern used by every route with an
// `:id` param (tickets.ts's GET/PATCH /:id, POST /:id/replies(/polish),
// POST /:id/summarize, and knowledge-docs.ts's GET /:id/file, DELETE /:id).
// Same shape as validateBody: sends the 400 itself and returns undefined on
// failure, so callers just do `if (id === undefined) return;`.
export function parseIntParam(
   value: unknown,
   res: Response,
   errorMessage: string
): number | undefined {
   const id = typeof value === 'string' ? Number.parseInt(value, 10) : NaN;
   if (!Number.isInteger(id)) {
      res.status(400).json({ error: errorMessage });
      return undefined;
   }

   return id;
}
