# Munchbase Shared Vocabulary

Use this repository’s terminology consistently in code, UI text, comments, and discussion.

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

## Before Declaring a Task Complete

Always run the following checks after making code changes, before reporting done:

1. **TypeScript** — `npx tsc --noEmit`
   Catches type errors that would fail the Docker build. This is the most important check — the build pipeline runs TypeScript and will reject the image if it fails.

2. **Check for multiple usages** — when adding a required prop to a component, grep for all usages before finishing:
   `grep -n "ComponentName" src/**/*.tsx`
   Missing a second usage site is a common build failure cause.

3. **Check imports** — if creating a new file that is imported elsewhere, confirm the file is actually saved and the import path is correct.

These are run locally and are fast. The goal is to catch issues before they surface as Docker build failures in CI.
