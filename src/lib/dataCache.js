/**
 * dataCache.js — Simple in-memory cache for page data.
 *
 * Why: Every page uses useEffect → useState to fetch data. When you navigate
 * away and come back (or switch tabs), React unmounts/remounts the component
 * and re-fetches everything from Supabase. This causes the spinner to show
 * every single time.
 *
 * This cache stores the last fetched data per key with a TTL. On remount,
 * pages get the cached data instantly (no spinner) and refresh silently
 * in the background.
 *
 * TTL: 2 minutes — fresh enough for a gym management app.
 */

const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

const store = new Map(); // key → { data, ts }

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
};
