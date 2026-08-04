/**
 * db.js  —  Supabase compatibility shim
 *
 * Exposes the same surface as the old Base44 `db` object so all existing
 * page / component code works unchanged.
 *
 * Timeout & retry strategy:
 * - Supabase free tier projects pause after 7 days of inactivity.
 *   The first request after a pause can take 10–30 s to wake the DB.
 * - We use a 30 s timeout on the first attempt and retry once on timeout,
 *   giving the DB a chance to wake up before surfacing an error.
 */

import { supabase } from './supabaseClient';

// ── Table name map ─────────────────────────────────────────────────────────────
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

function parseOrder(orderStr = '-created_date') {
  const desc = orderStr.startsWith('-');
  const col   = desc ? orderStr.slice(1) : orderStr;
  return { column: col, ascending: !desc };
}

function assertOk({ error }, context = '') {
  if (error) throw Object.assign(new Error(error.message || 'Supabase error'), { context, supabaseError: error });
}

/**
 * Race a promise against a timeout.
 * Throws an error whose message starts with "Query timed out" on timeout.
 */
function withTimeout(promise, ms, label = '') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Query timed out after ${ms}ms${label ? ` (${label})` : ''}`)),
        ms
      )
    ),
  ]);
}

/** Sleep for `ms` milliseconds */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * executeWithRetry
 *
 * Runs `fn` with a 30 s timeout on the first attempt.
 * If the DB is waking up (free tier cold start) and the first attempt times out,
 * waits 3 s then retries once with a fresh 25 s timeout.
 *
 * This means the worst case is ~58 s total before surfacing an error,
 * which comfortably covers Supabase free-tier cold-start latency (~10–25 s).
 */
async function executeWithRetry(fn, label = '') {
  const FIRST_TIMEOUT  = 30000; // 30 s — generous enough for a cold start
  const RETRY_DELAY    = 3000;  // 3 s gap to let DB finish waking
  const SECOND_TIMEOUT = 25000; // 25 s — DB should be warm by now

  try {
    return await withTimeout(fn(), FIRST_TIMEOUT, label);
  } catch (firstErr) {
    const isTimeout = firstErr.message?.startsWith('Query timed out');
    const isNetworkError = firstErr.message?.toLowerCase().includes('network') ||
                           firstErr.message?.toLowerCase().includes('fetch');

    // Only retry on timeout / network errors — not on auth or data errors
    if (isTimeout || isNetworkError) {
      console.warn(`[db] First attempt timed out for "${label}", retrying after ${RETRY_DELAY}ms...`);
      await sleep(RETRY_DELAY);
      // Retry — if this also times out, the error propagates to the caller
      return await withTimeout(fn(), SECOND_TIMEOUT, `${label} (retry)`);
    }

    throw firstErr;
  }
}

// ── Entity API factory ─────────────────────────────────────────────────────────

function makeEntityApi(tableName) {
  return {

    async list(orderStr = '-created_date', limit = 1000) {
      const { column, ascending } = parseOrder(orderStr);
      return executeWithRetry(async () => {
        const { data, error } = await supabase
          .from(tableName).select('*').order(column, { ascending }).limit(limit);
        assertOk({ error }, `${tableName}.list`);
        return data ?? [];
      }, `${tableName}.list`);
    },

    async filter(conditions = {}, orderStr = '-created_date', limit = 500) {
      const { column, ascending } = parseOrder(orderStr);
      return executeWithRetry(async () => {
        let query = supabase
          .from(tableName).select('*').order(column, { ascending }).limit(limit);
        for (const [col, val] of Object.entries(conditions)) {
          if (val !== undefined && val !== null) query = query.eq(col, val);
        }
        const { data, error } = await query;
        assertOk({ error }, `${tableName}.filter`);
        return data ?? [];
      }, `${tableName}.filter`);
    },

    async get(id) {
      return executeWithRetry(async () => {
        const { data, error } = await supabase
          .from(tableName).select('*').eq('id', id).maybeSingle();
        assertOk({ error }, `${tableName}.get(${id})`);
        if (!data) throw new Error(`${tableName} row not found: ${id}`);
        return data;
      }, `${tableName}.get`);
    },

    async create(payload) {
      const clean = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== undefined && v !== '')
      );
      return executeWithRetry(async () => {
        const { data, error } = await supabase
          .from(tableName).insert(clean).select().maybeSingle();
        assertOk({ error }, `${tableName}.create`);
        if (!data) throw new Error(`${tableName} insert returned no data — check RLS policies`);
        return data;
      }, `${tableName}.create`);
    },

    async update(id, payload) {
      const clean = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== undefined)
      );
      return executeWithRetry(async () => {
        const { data, error } = await supabase
          .from(tableName).update(clean).eq('id', id).select().maybeSingle();
        assertOk({ error }, `${tableName}.update(${id})`);
        return data ?? { id, ...clean };
      }, `${tableName}.update`);
    },

    async delete(id) {
      return executeWithRetry(async () => {
        const { error } = await supabase.from(tableName).delete().eq('id', id);
        assertOk({ error }, `${tableName}.delete(${id})`);
      }, `${tableName}.delete`);
    },
  };
}

// ── Auth surface ───────────────────────────────────────────────────────────────

async function me() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const { data } = await supabase
    .from('users').select('*').eq('id', session.user.id).maybeSingle();
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

async function logout(returnUrl) {
  await supabase.auth.signOut();
  if (returnUrl) window.location.href = returnUrl;
}

function redirectToLogin(returnUrl) {
  window.location.href = '/login' + (returnUrl ? `?returnTo=${encodeURIComponent(returnUrl)}` : '');
}

// ── File upload ────────────────────────────────────────────────────────────────

async function uploadFile({ file }) {
  const ext    = file.name.split('.').pop();
  const path   = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const bucket = 'uploads';
  const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { file_url: data.publicUrl };
}

async function inviteUser(email, role) {
  const { error } = await supabase.auth.admin.inviteUserByEmail(email, { data: { role } });
  if (error) throw new Error(error.message);
}

// ── Assemble db object ─────────────────────────────────────────────────────────

const entities = Object.fromEntries(
  Object.entries(TABLE_MAP).map(([name, table]) => [name, makeEntityApi(table)])
);

export const db = {
  auth: { me, isAuthenticated, logout, redirectToLogin },
  entities,
  integrations: { Core: { UploadFile: uploadFile } },
  users: { inviteUser },
  supabase,
};

export default db;
