-- Performance indexes migration
-- Run this in Supabase Dashboard → SQL Editor

-- Missing indexes identified in audit:

-- 1. payments.membership_id — used by computeBalance filtering payments per membership
create index if not exists payments_membership_id_idx
  on public.payments(membership_id);

-- 2. membership_events.membership_id — used by handleUnfreeze filter
create index if not exists membership_events_membership_id_idx
  on public.membership_events(membership_id);

-- 3. membership_events.member_id — used for member history lookups
create index if not exists membership_events_member_id_idx
  on public.membership_events(member_id);

-- 4. audit_logs.entity_id — used by MemberProfile audit filter
create index if not exists audit_logs_entity_id_idx
  on public.audit_logs(entity_id);

-- 5. audit_logs.created_date — used for ordering
create index if not exists audit_logs_created_date_idx
  on public.audit_logs(created_date desc);

-- 6. payments.payment_date — used by Payments page date filters
create index if not exists payments_payment_date_idx
  on public.payments(payment_date);

-- 7. memberships.end_date — used by deriveStatus and expiry queries
create index if not exists memberships_end_date_idx
  on public.memberships(end_date);

-- 8. attendance.timestamp — used for ordering and session lookups
create index if not exists attendance_timestamp_idx
  on public.attendance(timestamp desc);

-- 9. members.status — used to filter archived members
create index if not exists members_status_idx
  on public.members(status);

-- 10. member_id + checkout_timestamp compound — used by resolveActiveCheckin
create index if not exists attendance_member_open_idx
  on public.attendance(member_id, checkout_timestamp)
  where checkout_timestamp is null;
