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
