/**
 * base44Client.js — re-exports the Supabase db adapter as a drop-in
 * replacement for the old Base44 SDK client.
 *
 * All existing code that does:
 *   import db from '@/api/base44Client'   or
 *   const db = globalThis.__B44_DB__ || ...
 * will automatically use the Supabase-backed implementation.
 */
export { db, db as base44 } from './db';
export { db as default } from './db';
