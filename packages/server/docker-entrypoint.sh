#!/bin/sh
set -e

# Applies any pending migrations against DATABASE_URL (the `postgres`
# compose service) before the app starts — prisma migrate deploy is the
# non-interactive counterpart to `migrate dev`, safe to run on every
# container start (no-op if nothing's pending).
bunx prisma migrate deploy

exec bun run start:prod
