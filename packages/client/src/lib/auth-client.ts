import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
   // Mirrors the `role` additionalField from the server's auth config
   // (packages/server/lib/auth.ts) so `session.user.role` is typed
   // here instead of falling back to `any` — the two must stay in sync
   // if server-side additionalFields ever change.
   plugins: [inferAdditionalFields({ user: { role: { type: 'string' } } })],
});
