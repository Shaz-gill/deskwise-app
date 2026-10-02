import * as Sentry from '@sentry/node';

// Imported first thing in index.ts so Sentry can instrument everything
// that gets required afterwards. With SENTRY_DSN unset (e.g. local dev),
// Sentry.init() no-ops rather than throwing, so this is safe to leave
// configured everywhere.
Sentry.init({
   dsn: process.env.SENTRY_DSN,
   environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
});

export { Sentry };
