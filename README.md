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

To back up the database while the server is running (safe with WAL mode):

```bash
docker exec <container> sqlite3 /data/munchbase.db ".backup /data/munchbase.backup.db"
```

To restore: stop the container, replace the `.db` file, restart.

## Photo upload size

The default maximum is 10 MB per photo. If you change `PHOTO_MAX_SIZE_MB`, the server-action body limit is automatically synced — no other config needed.

## Development

```bash
cp .env.example .env.local
npm install
npm run db:migrate
npm run dev
```

Tests: `npm test`  
Lint: `npm run lint`  
Typecheck: `npx tsc --noEmit`

## Building the Docker image

```bash
docker compose build
docker compose up
```

The image uses a multi-stage build with a non-root `nextjs` user. The `/data` directory is owned by that user at build time.
