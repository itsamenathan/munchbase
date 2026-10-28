# Munchbase

Self-hosted restaurant tracker. Keep a private map of places worth remembering — with ratings, check-ins, photos, and lists.

## Quick start

```bash
# 1. Copy and edit the env file
cp .env.example .env

# 2. Set your public domain and OSM user agent (see Configuration below)
nano .env

# 3. Start
docker compose up -d
```

On first visit, you'll be prompted to create an admin account.

When using Docker Compose, values in `.env` are expanded into `docker-compose.yml`.
For production, set `APP_ORIGIN` to the exact public HTTPS URL before starting the container.

## HTTPS (required)

Session cookies require HTTPS in production. The app listens on port 3000 — put a TLS-terminating reverse proxy in front of it.

**Caddy** (recommended — automatic HTTPS):

```caddyfile
munchbase.example.com {
    reverse_proxy localhost:3000
}
```

**nginx** (with certbot or similar):

```nginx
server {
    listen 443 ssl;
    server_name munchbase.example.com;
    # ... your ssl_certificate / ssl_certificate_key lines

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Configuration

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_PATH` | yes | Absolute path to the SQLite file (e.g. `/data/munchbase.db`) |
| `APP_ORIGIN` | yes | Your public URL — **must be `https://` in production** (e.g. `https://munchbase.example.com`) |
| `OSM_USER_AGENT` | yes | Required by OSM Terms of Service — set to your app name/URL |
| `PHOTO_MAX_SIZE_MB` | no | Max photo upload size in MB (default: 10) |
| `NEXT_PUBLIC_TILE_URL` | no | Map tile URL template (default: OpenStreetMap) |

**Do not use `http://localhost` for `APP_ORIGIN` in production.** The app warns at startup if you do, and HTTPS cookie enforcement will silently break login.

## Data and backups

All data lives in the Docker volume `munchbase-data` (the SQLite database and an `uploads/` folder for photos). Back this volume up regularly.
Treat the entire volume as one backup unit so database records and restaurant photos stay consistent.

To back up the database while the server is running (safe with WAL mode):

```bash
docker exec <container> sqlite3 /data/munchbase.db ".backup /data/munchbase.backup.db"
```

Verify a live database without changing it with `mise run db:integrity` (or `npm run db:integrity`).

To restore, stop Munchbase, restore both the database and `uploads/` directory from the same backup, ensure the files are owned by the container's `nextjs` user, then restart. Pending migrations run before the restored instance becomes ready. If migration fails, the process exits and the structured container logs identify the failing stage; restore the original volume before attempting repairs.

Munchbase applies pending migrations automatically during Node startup, including after Docker image upgrades. Migration files are bundled into the image while `/data` remains persistent. Generate and commit migrations with `npm run db:generate`; validate their history with `npm run db:check`.

## Photo upload size

The default maximum is 10 MB per photo. If you change `PHOTO_MAX_SIZE_MB`, the server-action body limit is automatically synced — no other config needed.

## Observability

Munchbase writes its own logs and exports traces with the OpenTelemetry SDK. Trace export stays off until an OTLP endpoint is set, so local development and tests send nothing.

Logs go to stdout as one JSON object per line (`level`, `time`, `msg`, extra fields, and a serialized `err` for errors), written through `src/lib/logger.ts`. Lines logged inside a request also carry `trace_id`, `span_id` and `trace_flags`, so a collector that reads stdout can match them to the request's trace. Failed requests are logged with their route. Set `MUNCHBASE_LOG_LEVEL` (`debug`, `info`, `warn`, `error`; default `info`) to change the threshold. Output from Next.js itself is not JSON.

Traces are exported over OTLP/HTTP. Set the standard OpenTelemetry variables in `.env`:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://clickstack-collector.example:4318
OTEL_EXPORTER_OTLP_HEADERS=authorization=<ingestion key>
# OTEL_SERVICE_NAME=munchbase
```

Replace `clickstack-collector.example:4318` with the OTLP/HTTP address of your collector, and keep the ingestion key in `.env`, out of Git. `OTEL_SDK_DISABLED=true` switches export off again. Other `OTEL_*` variables, such as `OTEL_EXPORTER_OTLP_PROTOCOL` or `OTEL_BSP_SCHEDULE_DELAY`, are honored too. `docker-compose.yml` passes the variables named in this section through from `.env`; add any other `OTEL_*` variable to its `environment` list before setting it. Restart the container after changing them. Next.js produces the request spans, including route handlers.

The SDK does not export logs by default. A collector that already reads container output would store every line twice. Set `OTEL_LOGS_EXPORTER=otlp` to send them through the SDK as well, for example when nothing collects stdout. Log records are then sent to `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` or `OTEL_EXPORTER_OTLP_ENDPOINT`; a logs endpoint alone, without `OTEL_LOGS_EXPORTER=otlp`, exports nothing.

On shutdown, Next.js exits on SIGTERM without waiting for the SDK. Spans still queued in the last batch window (5 seconds by default) can be lost when the container stops. Lower `OTEL_BSP_SCHEDULE_DELAY` to shrink that window.

## Development

```bash
mise install
mise run setup
mise run dev
```

The setup task creates `.env.local` when needed, installs locked dependencies,
applies database migrations, and loads repeatable local test data.

- Tests: `mise run test`
- Lint: `mise exec -- npm run lint`
- Typecheck: `mise exec -- npx tsc --noEmit`
- All required checks: `mise run check`

## Building the Docker image

```bash
docker compose build
docker compose up
```

The image uses a multi-stage build with a non-root `nextjs` user. The `/data` directory is owned by that user at build time.

### Version stamp

The user menu shows the build version — the commit date and hash, e.g. `v2026-03-01 · 05017a9`, with the hash linking to that commit on GitHub. `/api/health` reports the same values.

The stamp is derived during the build from the repository itself, so `docker compose build`, a platform builder like Dokploy, and a local `npm run build` all produce a versioned image with no extra configuration. This is why `.git` is *not* in `.dockerignore` — it is read in the builder stage and never copied into the final image.

If you build from a source tarball or any context without `.git`, pass the values in instead:

```bash
MUNCHBASE_COMMIT=$(git rev-parse HEAD) \
MUNCHBASE_COMMIT_DATE=$(git log -1 --format=%cs) \
docker compose build     # or: mise run docker:build
```

When neither source is available the image still builds; the build log warns, the user menu hides the version row, and `/api/health` reports `"version": null` — which distinguishes "built without a stamp" from "not redeployed yet".
