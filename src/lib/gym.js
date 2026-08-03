
// ───────────────────────────────────────────────────────────
// Centralized constants, status definitions & permissions
// ───────────────────────────────────────────────────────────

export const MEMBERSHIP_STATUS = {
  ACTIVE: 'active',
  EXPIRING_SOON: 'expiring_soon',
  EXPIRED: 'expired',
  FROZEN: 'frozen',
  CANCELLED: 'cancelled',
};

export const STATUS_META = {
  active: { label: 'Active', tone: 'success', icon: 'CheckCircle2' },
  expiring_soon: { label: 'Expiring Soon', tone: 'warning', icon: 'AlertTriangle' },
  expired: { label: 'Expired', tone: 'danger', icon: 'XCircle' },
  frozen: { label: 'Frozen', tone: 'info', icon: 'Snowflake' },
  cancelled: { label: 'Cancelled', tone: 'muted', icon: 'Ban' },
};

export const ROLES = {
  owner: 'Owner',
  admin: 'Admin / Manager',
  reception: 'Reception / Staff',
};

export const ROLE_PERMISSIONS = {
  owner: '*',
  admin: [