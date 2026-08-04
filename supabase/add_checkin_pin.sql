-- Migration: add checkin_pin to members table
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Add the column (safe to run multiple times)
alter table public.members
  add column if not exists checkin_pin text;

-- 2. Back-fill existing members with a random 4-digit PIN
update public.members
set checkin_pin = lpad(floor(random() * 10000)::text, 4, '0')
where checkin_pin is null;
