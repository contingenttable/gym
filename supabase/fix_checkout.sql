-- Fix checkout issues
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Fix check_out_method default — should be NULL on new check-ins, not 'manual'
alter table public.attendance
  alter column check_out_method drop default;

-- 2. Update existing rows that have the wrong default
update public.attendance
set check_out_method = null
where checkout_timestamp is null
  and check_out_method = 'manual';

-- 3. Allow unauthenticated users (self check-in kiosk) to update attendance
--    for checkout. The kiosk needs to be able to close open sessions.
drop policy if exists "attendance: authenticated update" on public.attendance;

create policy "attendance: update checkout"
  on public.attendance for update
  using (true)
  with check (true);

-- 4. Confirm the fix_checkin_pin policies exist (idempotent)
create policy if not exists "members: public read for checkin"
  on public.members for select
  using (true);

create policy if not exists "memberships: public read for checkin"
  on public.memberships for select
  using (true);
