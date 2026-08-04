/**
 * db.js — Supabase compatibility shim
 *
 * Key fix: Every query is tied to an AbortController.
 * A global controller is replaced whenever the tab becomes visible again.
 * This cancels all in-flight "ghost" requests that were queued while the
 * tab was backgrounded — which was causing the app to freeze on tab return.
 */

import { supabase } from './supabaseClient';

const TABLE_MAP = {
  Member:            'members',
  Membership:        'memberships',
  MembershipPlan:    'membership_plans',
  MembershipEvent:   'membership_events',
  Payment:           'payments',
  PaymentAdjustment: 'payment_adjustments',
  Attendance:        'attendance',
  AuditLog:          'audit_logs',
  Setting:           'settings',
  User:              'users',
};

// ── Global abort controller ────────────────────────────────────────────────────
// Replaced every time the tab becomes visible, aborting any stale in-flight
// requests from when the tab was backgrounded.
let globalController = new AbortController();

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Abort all pending queries from before the tab came back
      globalController.abort();
      globalController = new AbortController();
    }
  });
}

/** Get the current abort signal — use this in every fetch */
const getSignal = () => globalController.signal;

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseOrder(orderStr = '-created_date') {
  const desc = orderStr.startsWith('-');
  return { column: desc ? orderStr.slice(1) : orderStr, ascending: !desc };
}

function assertOk({ error }, context = '') {
  if (error) throw Object.assign(new Error(error.message || 'Supabase error'), { context });
}

/**
 * withTimeout — race a promise against a timeout.
 * 30s first attempt, 25s on retry.
 */
function withTimeout(promise, ms, label = '') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Query timed out after ${ms}ms (${label})`)), ms)
    ),
  ]);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * run — execute a Supabase query builder with abort signal + timeout + retry.
 * `buildQuery` is a function that returns a fresh Supabase query object.
 * We call it twice (for retry) to get a fresh query with the new signal.
 */
async function run(buildQuery, label = '') {
  const FIRST_MS  = 30000;
  const RETRY_MS  = 25000;
  const RETRY_GAP = 3000;

  const attempt = (ms) => {
    // Build a fresh query with the current abort signal
    const query = buildQuery().abortSignal(getSignal());
    return withTimeout(query, ms, label);
  };

  try {
    return await attempt(FIRST_MS);
  } catch (err) {
    // Don't retry if the user aborted (tab switch) or it's a real data error
    if (err.name === 'AbortError') throw err;
    const isTimeout = err.message?.startsWith('Query timed out');
    const isNetwork = err.message?.toLowerCase().includes('network') ||
                      err.message?.toLowerCase().includes('fetch');
    if (!isTimeout && !isNetwork) throw err;

    console.warn(`[db] Retrying "${label}" after timeout...`);
    await sleep(RETRY_GAP);
    return await attempt(RETRY_MS);
  }
}

// ── Entity API factory ─────────────────────────────────────────────────────────

function makeEntityApi(tableName) {
  return {
    async list(orderStr = '-created_date', limit = 1000) {
      const { column, ascending } = parseOrder(orderStr);
      const { data, error } = await run(
        () => supabase.from(tableName).select('*').order(column, { ascending }).limit(limit),
        `${tableName}.list`
      );
      assertOk({ error }, `${tableName}.list`);
      return data ?? [];
    },

    async filter(conditions = {}, orderStr = '-created_date', limit = 500) {
      const { column, ascending } = parseOrder(orderStr);
      const { data, error } = await run(() => {
        let q = supabase.from(tableName).select('*').order(column, { ascending }).limit(limit);
        for (const [col, val] of Object.entries(conditions)) {
          if (val !== undefined && val !== null) q = q.eq(col, val);
        }
        return q;
      }, `${tableName}.filter`);
      assertOk({ error }, `${tableName}.filter`);
      return data ?? [];
    },

    async get(id) {
      const { data, error } = await run(
        () => supabase.from(tableName).select('*').eq('id', id).maybeSingle(),
        `${tableName}.get`
      );
      assertOk({ error }, `${tableName}.get`);
      if (!data) throw new Error(`${tableName} not found: ${id}`);
      return data;
    },

    async create(payload) {
      const clean = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== undefined && v !== '')
      );
      const { data, error } = await run(
        () => supabase.from(tableName).insert(clean).select().maybeSingle(),
        `${tableName}.create`
      );
      assertOk({ error }, `${tableName}.create`);
      if (!data) throw new Error(`${tableName} insert returned no data — check RLS`);
      return data;
    },

    async update(id, payload) {
      const clean = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== undefined)
      );
      const { data, error } = await run(
        () => supabase.from(tableName).update(clean).eq('id', id).select().maybeSingle(),
        `${tableName}.update`
      );
      assertOk({ error }, `${tableName}.update`);
      return data ?? { id, ...clean };
    },

    async delete(id) {
      const { error } = await run(
        () => supabase.from(tableName).delete().eq('id', id),
        `${tableName}.delete`
      );
      assertOk({ error }, `${tableName}.delete`);
    },
  };
}

// ── Auth ───────────────────────────────────────────────────────────────────────

async function me() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const { data } = await supabase.from('users').select('*').eq('id', session.user.id).maybeSingle();
  if (!data) return null;
  return { id: data.id, email: session.user.email, full_name: data.full_name || '', role: data.role || 'reception', ...data };
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
  const ext  = file.name.split('.').pop();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('uploads').upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('uploads').getPublicUrl(path);
  return { file_url: data.publicUrl };
}

async function inviteUser(email, role) {
  const { error } = await supabase.auth.admin.inviteUserByEmail(email, { data: { role } });
  if (error) throw new Error(error.message);
}

// ── Export ─────────────────────────────────────────────────────────────────────

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
