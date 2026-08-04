-- ============================================================
-- Gym Management App — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Enable UUID extension (usually already enabled)
create extension if not exists "pgcrypto";

-- ── users ────────────────────────────────────────────────────────────────────
-- Extends Supabase auth.users with app-level role & profile fields.
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'reception'
                   check (role in ('owner', 'admin', 'reception')),
  created_date timestamptz not null default now()
);

alter table public.users enable row level security;

-- Authenticated users can read all staff profiles (needed for Users page)
create policy "users: authenticated read"
  on public.users for select
  using (auth.role() = 'authenticated');

-- Users can update their own profile
create policy "users: self update"
  on public.users for update
  using (auth.uid() = id);

-- Only owners/admins can update other users' roles
create policy "users: admin update"
  on public.users for update
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role in ('owner', 'admin')
    )
  );

-- Trigger: auto-insert a users row when someone signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'reception')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── members ──────────────────────────────────────────────────────────────────
create table if not exists public.members (
  id                 uuid primary key default gen_random_uuid(),
  member_id          text,
  full_name          text not null,
  profile_photo      text,
  mobile             text,
  alt_mobile         text,
  email              text,
  dob                date,
  gender             text,
  address            text,
  emergency_contact  text,
  joining_date       date,
  notes              text,
  status             text not null default 'active'
                          check (status in ('active', 'inactive', 'archived')),
  qr_token           text unique,
  created_date       timestamptz not null default now()
);

alter table public.members enable row level security;

-- Public read so the self check-in kiosk (unauthenticated) can look up members
-- by mobile number or qr_token. Write operations still require authentication.
create policy "members: public read"
  on public.members for select
  using (true);

create policy "members: authenticated write"
  on public.members for all
  using (auth.role() = 'authenticated');

-- Index for fast mobile lookups (used by the self check-in kiosk)
create index if not exists members_mobile_idx on public.members(mobile);


-- ── membership_plans ─────────────────────────────────────────────────────────
create table if not exists public.membership_plans (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  duration_days  integer not null default 30,
  standard_fee   numeric not null default 0,
  description    text,
  active         boolean not null default true,
  notes          text,
  created_date   timestamptz not null default now()
);

alter table public.membership_plans enable row level security;

create policy "membership_plans: authenticated all"
  on public.membership_plans for all
  using (auth.role() = 'authenticated');


-- ── memberships ──────────────────────────────────────────────────────────────
create table if not exists public.memberships (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  plan_id      uuid references public.membership_plans(id) on delete set null,
  plan_name    text,
  start_date   date not null,
  end_date     date not null,
  fee          numeric not null default 0,
  discount     numeric not null default 0,
  status       text not null default 'active'
               check (status in ('active', 'expiring_soon', 'expired', 'frozen', 'cancelled')),
  notes        text,
  created_date timestamptz not null default now()
);

alter table public.memberships enable row level security;

-- Public read so the self check-in kiosk can read membership status
create policy "memberships: public read"
  on public.memberships for select
  using (true);

create policy "memberships: authenticated write"
  on public.memberships for all
  using (auth.role() = 'authenticated');

-- Index for fast member lookup
create index if not exists memberships_member_id_idx on public.memberships(member_id);


-- ── membership_events ────────────────────────────────────────────────────────
create table if not exists public.membership_events (
  id                    uuid primary key default gen_random_uuid(),
  membership_id         uuid not null references public.memberships(id) on delete cascade,
  member_id             uuid not null references public.members(id) on delete cascade,
  type                  text not null
                        check (type in ('creation','renewal','extension','freeze','unfreeze','correction','cancellation')),
  start_date            date,
  expected_unfreeze_date date,
  reason                text,
  notes                 text,
  created_date          timestamptz not null default now()
);

alter table public.membership_events enable row level security;

create policy "membership_events: authenticated all"
  on public.membership_events for all
  using (auth.role() = 'authenticated');


-- ── payments ─────────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id               uuid primary key default gen_random_uuid(),
  member_id        uuid not null references public.members(id) on delete cascade,
  member_name      text,
  membership_id    uuid references public.memberships(id) on delete set null,
  amount           numeric not null,
  payment_date     date not null,
  mode             text not null default 'cash'
                   check (mode in ('cash','upi','bank_transfer','card','other')),
  reference_number text,
  receipt_number   text,
  notes            text,
  status           text not null default 'active'
                   check (status in ('active','voided')),
  created_date     timestamptz not null default now()
);

alter table public.payments enable row level security;

create policy "payments: authenticated all"
  on public.payments for all
  using (auth.role() = 'authenticated');

create index if not exists payments_member_id_idx on public.payments(member_id);


-- ── payment_adjustments ──────────────────────────────────────────────────────
create table if not exists public.payment_adjustments (
  id               uuid primary key default gen_random_uuid(),
  payment_id       uuid not null references public.payments(id) on delete cascade,
  original_amount  numeric not null,
  corrected_amount numeric not null,
  reason           text not null,
  created_date     timestamptz not null default now()
);

alter table public.payment_adjustments enable row level security;

create policy "payment_adjustments: authenticated all"
  on public.payment_adjustments for all
  using (auth.role() = 'authenticated');


-- ── attendance ───────────────────────────────────────────────────────────────
create table if not exists public.attendance (
  id                  uuid primary key default gen_random_uuid(),
  member_id           uuid not null references public.members(id) on delete cascade,
  member_name         text,
  timestamp           timestamptz not null default now(),
  date                date not null,
  method              text not null default 'search'
                      check (method in ('search','qr')),
  checkout_timestamp  timestamptz,
  check_out_method    text default 'manual'
                      check (check_out_method in ('manual','auto')),
  correction_status   text default 'none'
                      check (correction_status in ('none','corrected')),
  notes               text,
  created_date        timestamptz not null default now()
);

alter table public.attendance enable row level security;

-- Public read + create for self check-in kiosk (unauthenticated)
create policy "attendance: public read"
  on public.attendance for select
  using (true);

create policy "attendance: public insert"
  on public.attendance for insert
  with check (true);

create policy "attendance: authenticated update"
  on public.attendance for update
  using (auth.role() = 'authenticated');

create policy "attendance: authenticated delete"
  on public.attendance for delete
  using (auth.role() = 'authenticated');

create index if not exists attendance_member_id_idx  on public.attendance(member_id);
create index if not exists attendance_date_idx       on public.attendance(date);


-- ── audit_logs ───────────────────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id             uuid primary key default gen_random_uuid(),
  action         text not null,
  entity         text not null,
  entity_id      text,
  previous_value text,
  new_value      text,
  reason         text,
  user_id        uuid references auth.users(id) on delete set null,
  created_date   timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create policy "audit_logs: authenticated all"
  on public.audit_logs for all
  using (auth.role() = 'authenticated');


-- ── settings ─────────────────────────────────────────────────────────────────
create table if not exists public.settings (
  id                              uuid primary key default gen_random_uuid(),
  gym_name                        text not null default 'DOYEN THE GYM',
  logo                            text,
  address                         text,
  phone                           text,
  email                           text,
  member_id_prefix                text not null default 'GYM',
  currency_symbol                 text not null default '₹',
  expiry_warning_days             integer not null default 7,
  attendance_duplicate_threshold  integer not null default 240,
  receipt_prefix                  text not null default 'RCP',
  timezone                        text not null default 'Asia/Kolkata',
  date_format                     text not null default 'dd MMM yyyy',
  role_permissions                jsonb,
  created_date                    timestamptz not null default now()
);

alter table public.settings enable row level security;

-- Public read so the self check-in kiosk can read gym name/logo
create policy "settings: public read"
  on public.settings for select
  using (true);

create policy "settings: authenticated write"
  on public.settings for all
  using (auth.role() = 'authenticated');

-- Seed default settings row
insert into public.settings (gym_name, member_id_prefix, currency_symbol, receipt_prefix)
values ('DOYEN THE GYM', 'GYM', '₹', 'RCP')
on conflict do nothing;


-- ============================================================
-- Storage bucket for file uploads (logo, member photos)
-- Run separately in Dashboard → Storage → New bucket
-- or uncomment and run via SQL if storage extension is enabled:
-- ============================================================
-- insert into storage.buckets (id, name, public)
-- values ('uploads', 'uploads', true)
-- on conflict do nothing;
