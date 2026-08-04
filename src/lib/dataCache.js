/**
 * dataCache.js — In-memory page data cache with TTL.
 *
 * TTL: 5 minutes. Pages show cached data instantly on re-mount
 * and refresh silently in the background.
 *
 * After a long tab absence (>30s), AppLayout calls invalidateAll()
 * so the next page mount fetches fresh data instead of stale cache.
 */

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const store = new Map();

export const cache = {
  get(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) {
      store.delete(key);
      return null;
    }
    return entry.data;
  },

  set(key, data) {
    store.set(key, { data, ts: Date.now() });
  },

  invalidate(key) {
    store.delete(key);
  },

  invalidateAll() {
    store.clear();
  },

  age(key) {
    const entry = store.get(key);
    return entry ? Date.now() - entry.ts : Infinity;
  },
};
