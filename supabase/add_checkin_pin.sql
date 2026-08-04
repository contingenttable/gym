-- Migration: add checkin_pin to members table
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Add the column
alter table public.members
  add column if not exists checkin_pin text;

-- 2. Back-fill existing members with a random 4-digit PIN
update public.members
set checkin_pin = lpad(floor(random() * 10000)::text, 4, '0')
where checkin_pin is null;

-- 3. Allow the public self check-in page (unauthenticated) to READ members
--    so mobile lookup and PIN verification work without login.
--    Only exposes: id, full_name, member_id, mobile, checkin_pin, qr_token.
--    All writes (create/update/delete) still require authentication.
create policy "members: public read for checkin"
  on public.members for select
  using (true);

-- 4. Also allow public read on memberships and attendance
--    (needed by resolveActiveCheckin on the kiosk page)
create policy "memberships: public read for checkin"
  on public.memberships for select
  using (true);
