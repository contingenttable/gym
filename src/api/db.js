/**
 * db.js  —  Supabase compatibility shim
 *
 * Exposes the same surface as the old Base44 `db` object so all existing
 * page / component code works unchanged:
 *
 *   db.entities.Member.list('-created_date', 1000)
 *   db.entities.Member.get(id)
 *   db.entities.Member.filter({ member_id: 'GYM-000001' }, '-created_date', 50)
 *   db.entities.Member.create({ full_name: '...' })
 *   db.entities.Member.update(id, { mobile: '...' })
 *   db.entities.Member.delete(id)
 *   db.auth.me()
 *   db.auth.logout()
 *   db.auth.redirectToLogin()
 *   db.integrations.Core.UploadFile({ file })
 *
 * Table names follow snake_case matching the Supabase SQL schema.
 */

import { supabase } from './supabaseClient';

// Map entity names (PascalCase as used in code) → Supabase table names
const TABLE_MAP = {
  Member:             'members',
  Membership:         'memberships',
  MembershipPlan:     'membership_plans',
  MembershipEvent:    'membership_events',
  Payment:            'payments',
  PaymentAdjustment:  'payment_adjustments',
  Attendance:         'attendance',
  AuditLog:           'audit_logs',
  Setting:            'settings',
  User:               'users',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Parse a Base44-style order string like '-created_date' into
 * Supabase .order(column, { ascending }) calls.
 */
function parseOrder(orderStr = '-created_date') {
  const desc = orderStr.startsWith('-');
  const col   = desc ? orderStr.slice(1) : orderStr;
  return { column: col, ascending: !desc };
}

/**
 * Wraps a Supabase promise with a timeout so hung queries
 * never freeze a page indefinitely.
 */
function withTimeout(promise, ms = 12000, label = '') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Query timed out after ${ms}ms${label ? ` (${label})` : ''}`)), ms)
    ),
  ]);
}

/**
 * Throw a consistent error from a Supabase response.
 */
function assertOk({ error }, context = '') {
  if (error) throw Object.assign(new Error(error.message || 'Supabase error'), { context, supabaseError: error });
}

// ── Entity proxy factory ───────────────────────────────────────────────────────

function makeEntityApi(tableName) {
  return {
    /**
     * list(orderStr?, limit?) → rows[]
     * e.g. db.entities.Member.list('-created_date', 1000)
     */
    async list(orderStr = '-created_date', limit = 1000) {
      const { column, ascending } = parseOrder(orderStr);
      const { data, error } = await withTimeout(
        supabase.from(tableName).select('*').order(column, { ascending }).limit(limit),
        12000, `${tableName}.list`
      );
      assertOk({ error }, `${tableName}.list`);
      return data ?? [];
    },

    /**
     * filter(conditions?, orderStr?, limit?) → rows[]
     * conditions is a plain object of { column: value } equality checks.
     * e.g. db.entities.Attendance.filter({ member_id: id }, '-created_date', 50)
     */
    async filter(conditions = {}, orderStr = '-created_date', limit = 500) {
      const { column, ascending } = parseOrder(orderStr);
      let query = supabase
        .from(tableName)
        .select('*')
        .order(column, { ascending })
        .limit(limit);

      for (const [col, val] of Object.entries(conditions)) {
        if (val !== undefined && val !== null) {
          query = query.eq(col, val);
        }
      }

      const { data, error } = await withTimeout(query, 12000, `${tableName}.filter`);
      assertOk({ error }, `${tableName}.filter`);
      return data ?? [];
    },

    async get(id) {
      const { data, error } = await withTimeout(
        supabase.from(tableName).select('*').eq('id', id).maybeSingle(),
        12000, `${tableName}.get`
      );
      assertOk({ error }, `${tableName}.get(${id})`);
      if (!data) throw new Error(`${tableName} row not found: ${id}`);
      return data;
    },

    async create(payload) {
      const clean = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== undefined)
      );
      const { data, error } = await withTimeout(
        supabase.from(tableName).insert(clean).select().maybeSingle(),
        12000, `${tableName}.create`
      );
      assertOk({ error }, `${tableName}.create`);
      if (!data) throw new Error(`${tableName} insert returned no data — check RLS policies`);
      return data;
    },

    async update(id, payload) {
      const clean = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== undefined)
      );
      const { data, error } = await withTimeout(
        supabase.from(tableName).update(clean).eq('id', id).select().maybeSingle(),
        12000, `${tableName}.update`
      );
      assertOk({ error }, `${tableName}.update(${id})`);
      // If data is null, the update was blocked by RLS or row doesn't exist.
      // Return a safe fallback so callers don't crash.
      return data ?? { id, ...clean };
    },

    async delete(id) {
      const { error } = await withTimeout(
        supabase.from(tableName).delete().eq('id', id),
        12000, `${tableName}.delete`
      );
      assertOk({ error }, `${tableName}.delete(${id})`);
    },
  };
}

// ── Auth surface ───────────────────────────────────────────────────────────────

/**
 * me() → user profile row from `users` table (with role etc.)
 * Returns null if not signed in.
 */
async function me() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  // Fetch the app-level user row which carries the `role` field
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  if (!data) return null;

  return {
    id:        data.id,
    email:     session.user.email,
    full_name: data.full_name || session.user.user_metadata?.full_name || '',
    role:      data.role || 'reception',
    ...data,
  };
}

async function isAuthenticated() {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session?.user;
}

/**
 * logout(returnUrl?) — signs out via Supabase then redirects.
 */
async function logout(returnUrl) {
  await supabase.auth.signOut();
  if (returnUrl) {
    window.location.href = returnUrl;
  }
}

/**
 * redirectToLogin(returnUrl?) — send user to /login.
 */
function redirectToLogin(returnUrl) {
  const dest = '/login' + (returnUrl ? `?returnTo=${encodeURIComponent(returnUrl)}` : '');
  window.location.href = dest;
}

// ── File upload ────────────────────────────────────────────────────────────────

/**
 * UploadFile({ file }) → { file_url: string }
 * Uploads to the `uploads` Supabase Storage bucket (public).
 */
async function uploadFile({ file }) {
  const ext      = file.name.split('.').pop();
  const path     = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const bucket   = 'uploads';

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { file_url: data.publicUrl };
}

// ── Users management (for Users page) ─────────────────────────────────────────

/**
 * inviteUser(email, role) — sends a Supabase magic-link invite.
 * The invited user gets inserted into `users` with the given role via a
 * database trigger (see SQL schema).
 */
async function inviteUser(email, role) {
  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { role },
  });
  if (error) throw new Error(error.message);
}

// ── Build entity map ───────────────────────────────────────────────────────────

const entities = Object.fromEntries(
  Object.entries(TABLE_MAP).map(([entityName, tableName]) => [
    entityName,
    makeEntityApi(tableName),
  ])
);

// ── Export the db object ───────────────────────────────────────────────────────

export const db = {
  auth: {
    me,
    isAuthenticated,
    logout,
    redirectToLogin,
  },
  entities,
  integrations: {
    Core: {
      UploadFile: uploadFile,
    },
  },
  users: {
    inviteUser,
  },
  // Expose raw supabase client for advanced use (e.g. AuthContext)
  supabase,
};

export default db;
