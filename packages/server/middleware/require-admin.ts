import type { RequestHandler } from 'express';

export const requireAdmin: RequestHandler = (req, res, next) => {
   if (req.user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
   }

   next();
};
