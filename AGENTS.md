# Munchbase Shared Vocabulary

Use this repository's terminology consistently in code, UI text, comments, and discussion.

## Core Terms

- `Munchbase`: the app name.
- `Explore`: the restaurant browsing page.
- `Map`: the map view.
- `Lists`: the list management page.
- `Add`: the restaurant creation flow.
- `Restaurant`: a place saved in the app.
- `List`: a grouping of restaurants.
- `List settings`: custom fields and list-level configuration for one list.
- `Global attributes`: custom fields that apply across all restaurants.
- `Check-in`: a visit record for a restaurant.
- `Place`: an OSM geocoding result (stored in the `places` table). A `Restaurant` wraps a `Place` with app-specific data (notes, ratings, etc.).

## Route Names

- `/explore`
- `/map`
- `/lists`
- `/add`
- `/restaurants/[id]`
- `/lists/settings`
- `/lists/[id]/settings`

## Preferred Wording

- Use `restaurant` instead of `entry`.
- Use `list` instead of `group` or `collection`.
- Use `settings` for configuration screens, not `prefs` or `options`.
- Use `user menu` for the top-right account menu.
- Use `back to Explore` when returning from restaurant detail on mobile.

## UI Labels

- `Explore`
- `Map`
- `Lists`
- `Add`
- `Admin`
- `Sign out`
- `Global attributes`
- `List settings`
- `Add restaurant`

## Writing Rules

- Keep mobile-first terminology stable.
- Do not rename core navigation concepts without updating the route structure.
- If a term appears in the UI, prefer reusing that exact term in code and comments.

---

## Tech Stack

- **Framework**: Next.js 16 App Router, React 19, TypeScript 6
- **Database**: SQLite via `better-sqlite3`. Drizzle ORM is initialized but most queries are raw SQL. Schema in `src/db/schema.ts`. DB auto-migrates on startup via `drizzle/` folder.
- **PWA**: Serwist (`@serwist/next`, `@serwist/sw`) — service worker at `src/sw.ts`. RSC navigation fetches are bypassed to avoid caching issues.
- **Maps**: Leaflet + react-leaflet (loaded dynamically to avoid SSR). Tile URL configurable via `NEXT_PUBLIC_TILE_URL`.
- **Place search**: Photon (komoot.io) geocoding API, proxied at `/api/search`. Nearby search uses reverse geocode with a 1 km radius.
- **Icons**: `lucide-react`
- **CSS**: Custom CSS, no Tailwind. Design tokens in `src/app/styles/tokens.css`. Component classes in `src/app/styles/components.css`. Mobile-first.
- **Testing**: Vitest (unit tests for lib utilities only — no component tests). Run with `npm test`.
- **Deployment**: Docker (multi-stage, node:26.3.1-alpine). Standalone Next.js output. DB at `/data/munchbase.db` inside container.

## Architecture

### Mutation pattern (important — no Server Actions)
All writes go through a single POST endpoint at `/mutate`. There are **no Next.js Server Actions**. Every form uses:
```html
<form action="/mutate" method="post">
  <input type="hidden" name="__action" value="mutationName" />
  ...
</form>
```
The handler (`src/app/mutate/route.ts`) dispatches to named functions in `src/lib/mutations.ts`. After success it redirects to `redirectTo` or back to the referer. Errors redirect with `?mutationError=code&message=text` query params, displayed by `MutationErrorMessage`.

After every mutation, call `revalidatePath("/", "layout")`.

### AppState / data loading
`getAppState(user, listId)` in `src/lib/db.ts` loads all app data in one server-side call. It returns an `AppState` object (typed in `src/lib/types.ts`) that is passed into the `AppShell` client component. The client re-derives filtered state (active list, visible restaurants, rating definitions) from this object without further fetches.

### AppShell
`src/components/app-shell.tsx` is the main `"use client"` component. It holds nearly all UI state: search query, filter, selected restaurant, panel open/close flags, user location. The active list is driven by the `?list=<id>` URL search param. Restaurant detail and settings panels render inline inside AppShell — `/restaurants/[id]` and `/lists/[id]/settings` are Next.js routes but their content is rendered by AppShell, not a separate page component.

### Offline / IndexedDB
`src/lib/offline-db.ts` manages an IndexedDB store (`munchbase-offline`) with object stores for restaurants, lists, app-state, and a sync-queue for deferred mutations.

### Auth
Cookie-based sessions. `currentUser()` in `src/lib/auth.ts` reads the session cookie and returns the user or null. Sessions expire automatically; the DB cleans them on every startup.

## Database Schema (key tables)

| Table | Purpose |
|---|---|
| `users` | Accounts; roles: `admin` / `user` |
| `sessions` | Auth sessions with expiry |
| `app_settings` | Singleton row (id=1); `selfSignupEnabled` |
| `places` | OSM geocoding results (`osm_type`, `osm_id`, lat/lon) |
| `restaurants` | App-specific data per place (notes, links). 1:1 with `places`. |
| `list_restaurants` | M:N join between lists and restaurants |
| `rating_definitions` | Rating schema: type (`choice`/`scale`/`boolean`), scope (`global`/`list`) |
| `rating_values` | Stored rating per (restaurant, definition) |
| `checkins` | Visit records with `visited_at` and optional notes |
| `restaurant_photos` | Photos stored on filesystem; served at `/media/[...key]` |

**Rating presets** (`presetKey`): `go_back`, `price`, `stars`. Global presets are seeded/synced at startup in `seedGlobalRatingPresets`. Preset-keyed definitions cannot be deleted, only toggled.

## Key Files

| File | Role |
|---|---|
| `src/lib/types.ts` | All shared TypeScript types (`AppState`, `Restaurant`, `RatingDefinition`, …) |
| `src/lib/mutations.ts` | All write operations (one exported function per action) |
| `src/app/mutate/route.ts` | Mutation dispatcher — maps `__action` name → function |
| `src/lib/db.ts` | DB connection, `getAppState()`, `getRestaurants()`, migration hooks |
| `src/db/schema.ts` | Drizzle schema (source of truth for table structure) |
| `src/lib/routes.ts` | URL helpers: `tabHref`, `restaurantHref`, `listSettingsHref` |
| `src/components/app-shell.tsx` | Main client component; all UI state lives here |
| `src/lib/ratings.ts` | Rating logic, preset definitions, value validation |
| `src/lib/auth.ts` | Session creation/reading, password hashing |
| `src/app/styles/tokens.css` | CSS custom properties (colors, spacing, etc.) |

## Environment Variables

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_PATH` | `./data/munchbase.db` | Absolute path in production |
| `APP_ORIGIN` | `http://localhost:3000` | Full public URL including scheme |
| `PHOTO_MAX_SIZE_MB` | `10` | Upload size limit |
| `NEXT_PUBLIC_TILE_URL` | OSM tile URL | Map tile template |
| `OSM_USER_AGENT` | `munchbase/0.1` | Required by OSM ToS |

## Dev Commands

```bash
npm run dev          # Start dev server on 0.0.0.0:3000
npm run build        # Production build
npm run db:generate  # Regenerate Drizzle migration files
npm run db:migrate   # Apply migrations
npm test             # Run Vitest unit tests
npx tsc --noEmit     # TypeScript check (run before declaring done)
```

## Before Declaring a Task Complete

Always run the following checks after making code changes, before reporting done:

1. **TypeScript** — `npx tsc --noEmit`
   Catches type errors that would fail the Docker build. This is the most important check — the build pipeline runs TypeScript and will reject the image if it fails.

2. **Check for multiple usages** — when adding a required prop to a component, grep for all usages before finishing:
   `grep -n "ComponentName" src/**/*.tsx`
   Missing a second usage site is a common build failure cause.

3. **Check imports** — if creating a new file that is imported elsewhere, confirm the file is actually saved and the import path is correct.

These are run locally and are fast. The goal is to catch issues before they surface as Docker build failures in CI.
