-- Migration: add checkin_pin to members table
-- Run this in Supabase Dashboard → SQL Editor

alter table public.members
  add column if not exists checkin_pin text;

-- Back-fill existing members with a random 4-digit PIN
update public.members
set checkin_pin = lpad(floor(random() * 10000)::text, 4, '0')
where checkin_pin is null;
