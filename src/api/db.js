/**
 * db.js — Supabase compatibility shim
 *
 * Tab-switch fix strategy:
 * When a tab is backgrounded, browser throttles JS + network.
 * Queued fetch requests resolve in bulk when tab returns, causing
 * "ghost" responses that confuse the Supabase client state.
 *
 * Solution: replace the global AbortController only when tab becomes
 * visible AND we are NOT in a user-initiated fetch (checked via counter).
 * AbortErrors from tab-switch are silently swallowed so the page keeps
 * showing its last data rather than going blank.
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

// ── Abort controller management ───────────────────────────────────────────────
let currentController = new AbortController();
let activeRequests = 0; // count of in-flight requests

function getSignal() { return currentController.signal; }

function abortAndReset() {
  currentController.abort();
  currentController = new AbortController();
}

// On tab focus: abort ghost requests only if nothing is actively running
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && activeRequests === 0) {
      abortAndReset();
    }
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseOrder(orderStr = '-created_date') {
  const desc = orderStr.startsWith('-');
  return { column: desc ? orderStr.slice(1) : orderStr, ascending: !desc };
}

function assertOk({ error }, context = '') {
  if (error) throw Object.assign(new Error(error.message || 'Supabase error'), { context });
}

function withTimeout(promise, ms, label = '') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms)
    ),
  ]);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * run — execute a query with abort signal, timeout, and retry on cold start.
 * AbortErrors are rethrown so callers can decide whether to ignore them.
 */
async function run(buildQuery, label = '') {
  activeRequests++;
  try {
    const attempt = (ms) => withTimeout(
      buildQuery().abortSignal(getSignal()),
      ms, label
    );

    try {
      return await attempt(30000);
    } catch (err) {
      if (err.name === 'AbortError') throw err; // propagate abort
      const retryable = err.message?.startsWith('Timeout') ||
                        err.message?.toLowerCase().includes('network') ||
                        err.message?.toLowerCase().includes('fetch');
      if (!retryable) throw err;
      console.warn(`[db] Retrying ${label}...`);
      await sleep(3000);
      return await attempt(25000);
    }
  } finally {
    activeRequests = Math.max(0, activeRequests - 1);
  }
}

// ── Entity API ─────────────────────────────────────────────────────────────────

function makeEntityApi(tableName) {
  return {
    async list(orderStr = '-created_date', limit = 1000) {
      const { column, ascending } = parseOrder(orderStr);
      const { data, error } = await run(
        () => supabase.from(tableName).select('*').order(column, { ascending }).limit(limit),
        `${tableName}.list`
      );
      assertOk({ error }); return data ?? [];
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
      assertOk({ error }); return data ?? [];
    },

    async get(id) {
      const { data, error } = await run(
        () => supabase.from(tableName).select('*').eq('id', id).maybeSingle(),
        `${tableName}.get`
      );
      assertOk({ error });
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
      assertOk({ error });
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
      assertOk({ error });
      return data ?? { id, ...clean };
    },

    async delete(id) {
      const { error } = await run(
        () => supabase.from(tableName).delete().eq('id', id),
        `${tableName}.delete`
      );
      assertOk({ error });
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

const entities = Object.fromEntries(
  Object.entries(TABLE_MAP).map(([name, table]) => [name, makeEntityApi(table)])
);

export const db = {
  auth: { me, isAuthenticated, logout, redirectToLogin },
  entities,
  integrations: { Core: { UploadFile: uploadFile } },
  users: { inviteUser },
  supabase,
  _abortAndReset: abortAndReset,
};

export default db;
