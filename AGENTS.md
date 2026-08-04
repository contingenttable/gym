# AGENTS.md

## Project Context

This is a gym management app. It uses React + Vite on the frontend and Supabase (Postgres + Auth + Storage) as the backend. Keep changes focused on the user's request and preserve existing project conventions.

## Key Files

- `src/`: frontend application source.
- `src/api/db.js`: Supabase db adapter — mimics the `db.entities.X` / `db.auth` API used throughout the app.
- `src/api/supabaseClient.js`: raw Supabase client (use via `db.js` unless you need direct access).
- `src/lib/gym.js`: shared constants, utility functions, permissions.
- `src/lib/AuthContext.jsx`: Supabase auth session context.
- `vite.config.js`: Vite config with `@` alias pointing to `src/`.
- `supabase/schema.sql`: full Postgres schema — run this in Supabase SQL Editor to set up the database.
- `.env.local`: local-only environment values; never commit secrets.

## Environment variables

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Working Notes

- `db` is set on `globalThis` in `src/main.jsx` before React renders — all pages use it as a global.
- Auth pages (`Login`, `Register`, `ForgotPassword`, `ResetPassword`) use `@supabase/supabase-js` directly.
- Run `npm run dev` for local frontend development.
- Run `npm run build` to verify the build before committing.
- Run `npm run lint` to check for lint errors.
