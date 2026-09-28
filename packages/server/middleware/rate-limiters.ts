import { type Options, rateLimit } from 'express-rate-limit';

const CREDENTIAL_PATHS = ['/sign-in'];

function createLimiter(limit: number, skip?: Options['skip']) {
   return rateLimit({
      windowMs: 15 * 60 * 1000,
      limit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Too many requests, please try again later.' },
      skip,
   });
}

export const authLimiter = createLimiter(
   20,
   (req) => !CREDENTIAL_PATHS.some((path) => req.path.includes(path))
);

export const inboundEmailLimiter = createLimiter(50);

export const polishLimiter = createLimiter(20);

export const summarizeLimiter = createLimiter(20);
