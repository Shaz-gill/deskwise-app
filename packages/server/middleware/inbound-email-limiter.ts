import { rateLimit } from 'express-rate-limit';

export const inboundEmailLimiter = rateLimit({
   windowMs: 15 * 60 * 1000, // 15 minutes
   limit: 50,
   standardHeaders: 'draft-8',
   legacyHeaders: false,
   message: { error: 'Too many requests, please try again later.' },
});
