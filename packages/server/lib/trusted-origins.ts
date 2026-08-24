// Origins allowed to talk to this API — shared by Better Auth's CSRF origin
// check (auth.ts) and the global CORS middleware (index.ts) so both stay in
// sync from a single env-driven source of truth instead of two copies of
// the same parsing logic.
export const trustedOrigins = (
   process.env.TRUSTED_ORIGINS ?? 'http://localhost:*'
)
   .split(',')
   .map((origin) => origin.trim())
   .filter(Boolean);

// Turns a trusted-origin pattern (an exact origin, or one containing `*`
// wildcards, e.g. "http://localhost:*" to allow any local port) into a
// match against a request's Origin header.
function matchesPattern(origin: string, pattern: string): boolean {
   if (!pattern.includes('*')) {
      return origin === pattern;
   }

   const regex = new RegExp(
      `^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`
   );
   return regex.test(origin);
}

export function isTrustedOrigin(origin: string): boolean {
   return trustedOrigins.some((pattern) => matchesPattern(origin, pattern));
}
