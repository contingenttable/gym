-- Fix checkout issues
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Fix check_out_method default — should be NULL on new check-ins, not 'manual'
alter table public.attendance
  alter column check_out_method drop default;

-- 2. Clear incorrect 'manual' value on currently open sessions
update public.attendance
set check_out_method = null
where checkout_timestamp is null
  and check_out_method = 'manual';

-- 3. Replace the old authenticated-only update policy with one that allows
--    unauthenticated checkout (needed for the self check-in kiosk page).
drop policy if exists "attendance: authenticated update" on public.attendance;
drop policy if exists "attendance: update checkout"     on public.attendance;

create policy "attendance: update checkout"
  on public.attendance for update
  using (true)
  with check (true);

-- 4. Ensure public read policies exist for the kiosk (drop + recreate = idempotent)
drop policy if exists "members: public read for checkin"      on public.members;
drop policy if exists "memberships: public read for checkin"  on public.memberships;
drop policy if exists "members: public read"                  on public.members;
drop policy if exists "memberships: public read"              on public.memberships;

create policy "members: public read"
  on public.members for select
  using (true);

create policy "memberships: public read"
  on public.memberships for select
  using (true);
