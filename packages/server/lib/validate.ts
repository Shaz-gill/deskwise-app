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
