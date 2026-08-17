# Better Auth Endpoints

Endpoints exposed by Better Auth as configured in `packages/server/lib/auth.ts` for this project: `basePath: '/api/auth'`, Prisma adapter, `emailAndPassword` enabled with `disableSignUp: true`, no social providers or plugins.

All paths below are relative to `/api/auth`, mounted in `packages/server/index.ts` via `toNodeHandler(auth)`. This lists the core routes Better Auth registers regardless of config — not all of them are meaningfully usable given the current setup (noted where relevant).

## Email & Password

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/sign-up/email` | Registered, but **disabled** — `disableSignUp: true` makes it always return a `400 BAD_REQUEST`. Users must be pre-provisioned another way. |
| POST | `/sign-in/email` | Body: `email`, `password`, `callbackURL?`, `rememberMe?`. Sets the session cookie on success. |
| POST | `/sign-out` | Revokes the current session. |
| POST | `/verify-password` | Verifies a password without creating a session. |

## Session

| Method | Path | Notes |
| --- | --- | --- |
| GET / POST | `/get-session` | Returns the current session + user, or `null`. |
| GET | `/list-sessions` | Lists all active sessions for the current user. |
| POST | `/revoke-session` | Revokes one session by token. |
| POST | `/revoke-sessions` | Revokes all sessions for the current user. |
| POST | `/revoke-other-sessions` | Revokes all sessions except the current one. |
| POST | `/update-session` | Updates session data. |

## User Account Management

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/update-user` | Update name/image/other profile fields. |
| POST | `/change-password` | Requires current password. |
| POST | `/change-email` | Triggers verification flow if email verification is configured. |
| POST | `/delete-user` | Self-service account deletion. |
| GET | `/delete-user/callback` | Confirmation callback for delete-user (when verification is required). |

## Password Reset

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/request-password-reset` | **Not functional as configured** — `lib/auth.ts` doesn't set `emailAndPassword.sendResetPassword`, so this logs a server error instead of sending an email. Add that callback before relying on this flow. |
| GET | `/reset-password/:token` | Redirect target from the reset email. |
| POST | `/reset-password` | Completes the reset with a new password. |

## Email Verification

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/send-verification-email` | **Not functional as configured** — no `emailVerification.sendVerificationEmail` callback is set in `lib/auth.ts`. |
| GET | `/verify-email` | Verifies via the token from the verification email. |

## Linked Accounts (OAuth/social)

Registered by Better Auth's core, but **no social providers are configured**, so these are effectively dead until a provider (Google, GitHub, etc.) is added to `lib/auth.ts`:

| Method | Path |
| --- | --- |
| POST | `/sign-in/social` |
| GET / POST | `/callback/:id` |
| GET | `/list-accounts` |
| POST | `/link-social` |
| POST | `/unlink-account` |
| GET | `/account-info` |
| POST | `/get-access-token` |
| POST | `/refresh-token` |

## Misc

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/ok` | Health-check-style endpoint, always returns `{ ok: true }`. |
| GET | `/error` | Generic error redirect target. |

## To make the disabled flows work

- **Password reset**: add `emailAndPassword.sendResetPassword` (an async function given `{ user, url, token }`) in `lib/auth.ts`, wired to whichever email provider `docs/tech-stack.md` settles on (SendGrid/Mailgun).
- **Email verification**: add `emailVerification.sendVerificationEmail` similarly, and set `emailVerification.sendOnSignUp`/`requireEmailVerification` if desired.

## Protecting routes

Use `requireAuth` from `packages/server/middleware/require-auth.ts` on any route that needs a signed-in user — it calls `auth.api.getSession`, attaches `req.user`/`req.session` (typed in `packages/server/express.d.ts`), and returns `401` if there's no session. `GET /api/me` is the first example of this pattern.
