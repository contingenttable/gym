-- Fix: allow self check-in kiosk (unauthenticated) to read members & memberships
-- Run this in: Supabase Dashboard → SQL Editor → New query

-- 1. Drop the old "authenticated only" policies on members
drop policy if exists "members: authenticated all" on public.members;

-- 2. Add split policies: public read, authenticated write
create policy "members: public read"
  on public.members for select
  using (true);

create policy "members: authenticated write"
  on public.members for all
  using (auth.role() = 'authenticated');

-- 3. Index for fast mobile lookups from the kiosk
create index if not exists members_mobile_idx on public.members(mobile);

-- 4. Drop the old "authenticated only" policy on memberships
drop policy if exists "memberships: authenticated all" on public.memberships;

-- 5. Add split policies: public read, authenticated write
create policy "memberships: public read"
  on public.memberships for select
  using (true);

create policy "memberships: authenticated write"
  on public.memberships for all
  using (auth.role() = 'authenticated');
