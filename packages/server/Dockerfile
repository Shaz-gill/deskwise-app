# Built with repo root as context (a Bun workspace: `core` is consumed via
# the workspace protocol, so `bun install` needs the whole monorepo, not
# just this package) — see docker-compose.yml's `context: .`.

FROM oven/bun:1-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/client/package.json packages/client/package.json
RUN bun install --frozen-lockfile

FROM deps AS build
COPY packages/core packages/core
COPY packages/server packages/server
WORKDIR /repo/packages/server
RUN bunx prisma generate

FROM base AS runtime
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/core packages/core
COPY --from=build /repo/packages/server packages/server
WORKDIR /repo/packages/server
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
