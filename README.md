# Gym Management App

A full-featured gym management system built with React + Vite, backed by Supabase, and deployed on Vercel.

## Features

- Member registration & profiles with QR cards
- Membership plans, renewals, bulk renewals, freeze/unfreeze
- Attendance tracking — search, QR scan, self check-in kiosk
- Payment ledger with receipt printing
- Analytics dashboard, reports & CSV export
- Role-based access control (Owner / Admin / Reception)
- Audit log for all sensitive actions
- Dark mode

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Radix UI, Recharts |
| Backend / DB | Supabase (Postgres + Auth + Storage) |
| Hosting | Vercel |

## Local development

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` in the project root:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

## Deployment

See **[DEPLOY.md](./DEPLOY.md)** for the full step-by-step guide covering:
- Supabase project setup & schema
- GitHub repository setup
- Vercel deployment with environment variables

## Project structure

```
src/
  api/          # Supabase client + db adapter shim
  components/   # UI components (gym-specific + shadcn/ui)
  lib/          # Auth context, utilities, permissions
  pages/        # Route-level page components
config/         # App-level entity & config definitions
supabase/       # Database schema SQL
```
