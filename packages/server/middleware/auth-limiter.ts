import { rateLimit } from 'express-rate-limit';

const CREDENTIAL_PATHS = [
   '/sign-in',
   '/sign-up',
   '/change-password',
   '/change-email',
];

export const authLimiter = rateLimit({
   windowMs: 15 * 60 * 1000,
   limit: 20,
   standardHeaders: 'draft-8',
   legacyHeaders: false,
   message: { error: 'Too many requests, please try again later.' },
   skip: (req) => !CREDENTIAL_PATHS.some((path) => req.path.includes(path)),
});
