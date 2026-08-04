/**
 * gym.js — Centralized constants, helpers & business logic
 *
 * Reconstructed from all usages across the codebase.
 * Previously many of these functions were injected at runtime by Base44.
 */

import { db } from '@/api/db.js';

// ── Membership status ────────────────────────────────────────────────────────

export const MEMBERSHIP_STATUS = {
  ACTIVE: 'active',
  EXPIRING_SOON: 'expiring_soon',
  EXPIRED: 'expired',
  FROZEN: 'frozen',
  CANCELLED: 'cancelled',
};

export const STATUS_META = {
  active:        { label: 'Active',        tone: 'success', icon: 'CheckCircle2' },
  expiring_soon: { label: 'Expiring Soon', tone: 'warning', icon: 'AlertTriangle' },
  expired:       { label: 'Expired',       tone: 'danger',  icon: 'XCircle' },
  frozen:        { label: 'Frozen',        tone: 'info',    icon: 'Snowflake' },
  cancelled:     { label: 'Cancelled',     tone: 'muted',   icon: 'Ban' },
};

// ── Roles & permissions ──────────────────────────────────────────────────────

export const ROLES = {
  owner:     'Owner',
  admin:     'Admin / Manager',
  reception: 'Reception / Staff',
};

export const ROLE_PERMISSIONS = {
  owner: '*',
  admin: [
    'member.view', 'member.create', 'member.edit',
    'membership.view', 'membership.renew', 'membership.freeze',
    'payment.view', 'payment.create', 'payment.correct',
    'attendance.view', 'attendance.create',
    'plan.view', 'plan.create', 'plan.edit',
    'report.view',
    'audit.view',
    'user.view',
    'settings.view',
  ],
  reception: [
    'member.view', 'member.create', 'member.edit',
    'membership.view', 'membership.renew',
    'payment.view', 'payment.create',
    'attendance.view', 'attendance.create',
    'plan.view',
  ],
};

// Runtime-mutable permissions (updated from Settings → Users tab)
let _runtimePerms = null;

export function setRolePermissions(perms) {
  _runtimePerms = perms || null;
}

/**
 * can(user, permission) → boolean
 * Checks whether the given user has the specified permission.
 */
export function can(user, permission) {
  const role = user?.role || 'reception';
  if (role === 'owner') return true;
  const perms = (_runtimePerms || ROLE_PERMISSIONS)[role] || [];
  return Array.isArray(perms) ? perms.includes(permission) : false;
}

// ── Payment helpers ──────────────────────────────────────────────────────────

export const PAYMENT_MODES = [
  { value: 'cash',          label: 'Cash' },
  { value: 'upi',           label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card',          label: 'Card / Offline POS' },
  { value: 'other',         label: 'Other' },
];

export const PAYMENT_MODE_LABEL = {
  cash:          'Cash',
  upi:           'UPI',
  bank_transfer: 'Bank Transfer',
  card:          'Card / Offline POS',
  other:         'Other',
};

// ── Date utilities ───────────────────────────────────────────────────────────

/** Returns today's date as 'YYYY-MM-DD' */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Add `days` to a 'YYYY-MM-DD' string and return a new 'YYYY-MM-DD' string */
export function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Days remaining until `dateStr` (negative = already past) */
export function daysRemaining(dateStr) {
  if (!dateStr) return -9999;
  const diff = new Date(dateStr).getTime() - new Date(todayISO()).getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * formatDate('2024-06-01') → '01 Jun 2024'
 * Falls back gracefully for invalid input.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * formatDateTime('2024-06-01T10:30:00Z') → '01 Jun 2024, 10:30 AM'
 */
export function formatDateTime(dtStr) {
  if (!dtStr) return '—';
  try {
    return new Date(dtStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch {
    return dtStr;
  }
}

// ── Currency ─────────────────────────────────────────────────────────────────

export function formatCurrency(amount, symbol = '₹') {
  const n = Number(amount || 0);
  return `${symbol}${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// ── Membership status derivation ─────────────────────────────────────────────

/**
 * deriveStatus(membership, warningDays?) → status string
 * Ignores the stored status and re-derives from dates so it's always fresh.
 */
export function deriveStatus(membership, warningDays = 7) {
  if (!membership) return 'expired';
  if (membership.status === 'frozen')    return 'frozen';
  if (membership.status === 'cancelled') return 'cancelled';

  const days = daysRemaining(membership.end_date);
  if (days < 0)              return 'expired';
  if (days <= warningDays)   return 'expiring_soon';
  return 'active';
}

// ── Balance / dues ───────────────────────────────────────────────────────────

/**
 * computeBalance(membership, payments) → outstanding amount
 * payments should be an array of payment objects for that membership.
 */
export function computeBalance(membership, payments = []) {
  if (!membership) return 0;
  const fee  = Number(membership.fee || 0);
  const paid = payments
    .filter((p) => p.status !== 'voided' && (!p.membership_id || p.membership_id === membership.id))
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  return Math.max(0, fee - paid);
}

// ── Attendance helpers ───────────────────────────────────────────────────────

/**
 * isActiveCheckin(record) → true if the check-in has no checkout yet
 */
export function isActiveCheckin(record) {
  return !record.checkout_timestamp;
}

/**
 * checkOutDue(record, thresholdMinutes) → true if the open session is overdue
 */
export function checkOutDue(record, thresholdMinutes = 240) {
  if (!isActiveCheckin(record)) return false;
  const mins = (Date.now() - new Date(record.timestamp).getTime()) / 60000;
  return mins >= thresholdMinutes;
}

/** Returns the ISO string for when auto-checkout should have happened */
export function autoCheckoutTime(record, thresholdMinutes = 240) {
  const t = new Date(record.timestamp);
  t.setMinutes(t.getMinutes() + thresholdMinutes);
  return t.toISOString();
}

/**
 * sessionDuration(record) → minutes (number)
 */
export function sessionDuration(record) {
  const out = record.checkout_timestamp
    ? new Date(record.checkout_timestamp)
    : new Date();
  const inn = new Date(record.timestamp);
  return Math.round((out.getTime() - inn.getTime()) / 60000);
}

/**
 * formatDuration(minutes) → '1h 23m'
 */
export function formatDuration(mins) {
  if (!mins && mins !== 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/**
 * resolveActiveCheckin(memberId, thresholdMinutes)
 * Returns the open attendance record for `memberId`, or null.
 * Auto-closes any records that are past the threshold.
 */
export async function resolveActiveCheckin(memberId, thresholdMinutes = 240) {
  const records = await globalThis.db.entities.Attendance.filter({ member_id: memberId }, '-created_date', 50);
  const open = records.find(isActiveCheckin);
  if (!open) return null;

  if (checkOutDue(open, thresholdMinutes)) {
    await globalThis.db.entities.Attendance.update(open.id, {
      checkout_timestamp: autoCheckoutTime(open, thresholdMinutes),
      check_out_method: 'auto',
    });
    return null;
  }
  return open;
}

/**
 * checkoutMember(memberId, method, thresholdMinutes)
 * Closes the open check-in for a member and returns the closed record.
 */
export async function checkoutMember(memberId, method = 'manual', thresholdMinutes = 240) {
  const open = await resolveActiveCheckin(memberId, thresholdMinutes);
  if (!open) return null;
  const updated = await globalThis.db.entities.Attendance.update(open.id, {
    checkout_timestamp: new Date().toISOString(),
    check_out_method: method,
  });
  return updated;
}

// ── Settings ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  gym_name: 'DOYEN THE GYM',
  member_id_prefix: 'GYM',
  receipt_prefix: 'RCP',
  currency_symbol: '₹',
  expiry_warning_days: 7,
  attendance_duplicate_threshold: 240,
  timezone: 'Asia/Kolkata',
  date_format: 'dd MMM yyyy',
};

export async function getSettings() {
  try {
    const rows = await globalThis.db.entities.Setting.list('-created_date', 1);
    if (rows && rows.length > 0) return { ...DEFAULT_SETTINGS, ...rows[0] };
  } catch (e) {
    console.warn('getSettings failed, using defaults', e);
  }
  return { ...DEFAULT_SETTINGS };
}

// ── ID / receipt generators ───────────────────────────────────────────────────

/**
 * nextMemberId(prefix) → 'GYM-000042'
 */
export async function nextMemberId(prefix = 'GYM') {
  const members = await globalThis.db.entities.Member.list('-created_date', 9999);
  const nums = members
    .map((m) => {
      const match = (m.member_id || '').match(/-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(Boolean);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${String(next).padStart(6, '0')}`;
}

/**
 * nextReceiptNumber(prefix) → 'RCP-000007'
 * Gets the current settings receipt prefix, falls back to provided prefix.
 */
export async function nextReceiptNumber(prefix = 'RCP') {
  try {
    const settings = await getSettings();
    const pfx = settings?.receipt_prefix || prefix;
    const payments = await globalThis.db.entities.Payment.list('-created_date', 9999);
    const nums = payments
      .map((p) => {
        const match = (p.receipt_number || '').match(/-(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(Boolean);
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `${pfx}-${String(next).padStart(6, '0')}`;
  } catch {
    return `${prefix}-${Date.now()}`;
  }
}

// ── QR token ─────────────────────────────────────────────────────────────────

export function generateQrToken() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// ── Audit log ─────────────────────────────────────────────────────────────────

/**
 * logAudit({ action, entity, entity_id, previous_value, new_value, reason })
 * Fire-and-forget; errors are swallowed so they never block the main flow.
 */
export async function logAudit({ action, entity, entity_id, previous_value, new_value, reason }) {
  try {
    await globalThis.db.entities.AuditLog.create({
      action,
      entity,
      entity_id: entity_id || '',
      previous_value: previous_value ? JSON.stringify(previous_value) : null,
      new_value:      new_value      ? JSON.stringify(new_value)      : null,
      reason: reason || '',
    });
  } catch (e) {
    console.warn('logAudit failed (non-fatal):', e?.message);
  }
}

// ── CSV export ───────────────────────────────────────────────────────────────

/**
 * exportToCSV(filename, rows, columns)
 * columns: [{ label: string, value: string | (row) => string }]
 */
export function exportToCSV(filename, rows, columns) {
  const header = columns.map((c) => `"${c.label}"`).join(',');
  const body = rows.map((row) =>
    columns.map((c) => {
      const v = typeof c.value === 'function' ? c.value(row) : (row[c.value] ?? '');
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(',')
  );
  const csv = [header, ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Permission groups (used by RolesMatrix UI) ────────────────────────────────

export const PERMISSION_GROUPS = [
  {
    group: 'Members',
    perms: [
      { key: 'member.view',   label: 'View members' },
      { key: 'member.create', label: 'Add new members' },
      { key: 'member.edit',   label: 'Edit member profiles' },
    ],
  },
  {
    group: 'Memberships',
    perms: [
      { key: 'membership.view',   label: 'View memberships' },
      { key: 'membership.renew',  label: 'Renew / create memberships' },
      { key: 'membership.freeze', label: 'Freeze / unfreeze memberships' },
    ],
  },
  {
    group: 'Payments',
    perms: [
      { key: 'payment.view',    label: 'View payments' },
      { key: 'payment.create',  label: 'Record payments' },
      { key: 'payment.correct', label: 'Void / correct payments' },
    ],
  },
  {
    group: 'Attendance',
    perms: [
      { key: 'attendance.view',   label: 'View attendance' },
      { key: 'attendance.create', label: 'Check in / out members' },
    ],
  },
  {
    group: 'Plans',
    perms: [
      { key: 'plan.view',   label: 'View plans' },
      { key: 'plan.create', label: 'Create plans' },
      { key: 'plan.edit',   label: 'Edit plans' },
    ],
  },
  {
    group: 'Reports & Admin',
    perms: [
      { key: 'report.view',   label: 'View reports' },
      { key: 'audit.view',    label: 'View audit log' },
      { key: 'user.view',     label: 'View staff users' },
      { key: 'settings.view', label: 'View settings' },
    ],
  },
];
