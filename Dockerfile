# Pin the full node version so builds are reproducible.
# Update this intentionally rather than getting surprised by a Node patch pull.
FROM node:26.3.1-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# BuildKit cache mount keeps the npm cache between builds — meaningfully faster rebuilds.
# --no-save prevents the extra sharp install from touching package-lock.json in the layer.
RUN --mount=type=cache,target=/root/.npm \
    npm ci && \
    npm install --no-save --os=linux --libc=musl --cpu=x64 sharp

FROM node:26.3.1-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:26.3.1-alpine AS runner
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
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]
