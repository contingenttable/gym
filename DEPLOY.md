# Deployment Guide

## What was done

- Removed Base44 dependency entirely
- Added **Supabase** as the database + auth backend (compatible shim — no page code was changed)
- Added **Vercel** config for hosting
- Build is verified and passing ✓

---

## Step 1 — Create Supabase project

1. Go to https://supabase.com and sign in (or create a free account)
2. Click **New project** → name it `gym-management` → choose a region → set a DB password → Create
3. Wait ~2 minutes for it to provision
4. Go to **Settings → API** and copy:
   - **Project URL** → `https://xxxxxxxxxxxx.supabase.co`
   - **anon public** key → long JWT string

---

## Step 2 — Run the database schema

1. In your Supabase project, go to **SQL Editor → New query**
2. Open `supabase/schema.sql` from this repo
3. Paste the entire contents and click **Run**
4. All tables, RLS policies, and triggers will be created

### Create the Storage bucket (for logos / photos)

In Supabase → **Storage → New bucket**:
- Name: `uploads`
- Check **Public bucket** → Create

---

## Step 3 — Create your first owner account

1. Go to Supabase → **Authentication → Users → Invite user** (or Add user)
2. Enter your email and a password
3. After the user is created, go to **Table Editor → users**
4. Find your user row and set `role` to `owner`

---

## Step 4 — Push to GitHub

1. Go to https://github.com/new
2. Name the repo (e.g. `gym-management`), set it **Private**, click **Create repository**
3. Run these commands in your terminal (d:\gym):

```bash
git remote add origin https://github.com/YOUR_USERNAME/gym-management.git
git push -u origin main
```

---

## Step 5 — Deploy on Vercel

1. Go to https://vercel.com → **Add New Project**
2. Import your GitHub repo (`gym-management`)
3. Framework preset: **Vite** (auto-detected)
4. Under **Environment Variables**, add:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | `https://xxxxxxxxxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `your_anon_key_here` |

5. Click **Deploy** — done!

Every future `git push` to `main` auto-deploys.

---

## Step 6 — Local development

Create `.env.local` in the project root:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

Then run:
```bash
npm run dev
```

---

## Architecture summary

```
Browser (React + Vite)
       │
       ▼
Supabase (Postgres + Auth + Storage)
  - All gym data in Postgres tables
  - Auth: email/password + Google OAuth
  - File storage: member photos, gym logo
       │
       ▼
Vercel (static hosting + CDN)
  - Serves the built React app
  - Auto-deploy on every git push
```

## Security notes

- `.env.local` is gitignored — never commit it
- The Supabase **anon key** is safe to expose client-side (it's designed for this)
- Row Level Security (RLS) on all tables ensures data is protected
- The `service_role` key must NEVER go in frontend code
