# Built with repo root as context, same reason as packages/server/Dockerfile
# — see docker-compose.yml's `context: .`.

FROM oven/bun:1-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/package.json
COPY packages/client/package.json packages/client/package.json
RUN bun install --frozen-lockfile

FROM deps AS build
COPY packages/core packages/core
COPY packages/client packages/client
WORKDIR /repo/packages/client
# Vite inlines VITE_* vars at build time (not readable at container start),
# so they have to come in as build args — both optional, same as local dev.
ARG VITE_SENTRY_DSN
ARG VITE_SENTRY_ENVIRONMENT
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT
RUN bun run build

FROM caddy:2-alpine
COPY --from=build /repo/packages/client/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
