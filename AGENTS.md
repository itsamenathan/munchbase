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
