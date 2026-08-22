# Pin the full Bun version so builds are reproducible.
# Update this intentionally rather than getting surprised by a Bun patch pull.
FROM oven/bun:1.4.0-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
# BuildKit cache mount keeps the Bun cache between builds — meaningfully faster rebuilds.
# The image is musl/x64, so Bun resolves sharp's matching @img platform packages
# without the extra targeted install npm needed here.
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM oven/bun:1.4.0-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# The version stamp shown in the app comes from the repo in the build context.
# git is not in the base image, and platform builders (Dokploy, CI) clone the repo
# rather than invoking docker build from a shell, so deriving it here keeps the
# stamp working with no per-deployment configuration.
RUN apk add --no-cache git
# The build args stay as an override for contexts with no .git (e.g. an image built
# from a source tarball). Empty values fall through to the repo lookup.
ARG MUNCHBASE_COMMIT=""
ARG MUNCHBASE_COMMIT_DATE=""
ENV MUNCHBASE_COMMIT=$MUNCHBASE_COMMIT
ENV MUNCHBASE_COMMIT_DATE=$MUNCHBASE_COMMIT_DATE
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The copied repo is not owned by the build user, which git otherwise refuses to read.
RUN git config --global --add safe.directory /app
RUN bun run build

FROM oven/bun:1.4.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_PATH=/data/munchbase.db
ENV HOSTNAME=0.0.0.0
# Create user and data dir in one layer.
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs && \
    mkdir -p /data && chown nextjs:nextjs /data
# Set ownership at copy time rather than a separate chown RUN.
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/drizzle ./drizzle
# Next.js standalone omits sharp's native @img modules — copy them explicitly.
COPY --from=builder --chown=nextjs:nextjs /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder --chown=nextjs:nextjs /app/node_modules/@img ./node_modules/@img
USER nextjs
EXPOSE 3000
# SQLite now comes from bun:sqlite, built into the runtime — there is no native
# module to rebuild, so the runner image needs no toolchain.
CMD ["bun", "server.js"]
