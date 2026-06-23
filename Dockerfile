FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Install deps, then force-install the musl sharp binary regardless of what
# the lockfile (generated on macOS) recorded for the optional platform packages.
RUN npm ci && \
    npm install --os=linux --libc=musl --cpu=x64 sharp

FROM node:26-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_PATH=/data/munchbase.db
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Next.js standalone omits sharp's native @img modules — copy them explicitly.
COPY --from=builder /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder /app/node_modules/@img ./node_modules/@img
RUN mkdir -p /data && chown nextjs:nextjs /data
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
