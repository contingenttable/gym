/**
 * dataCache.js — In-memory page data cache with TTL.
 * TTL: 5 minutes.
 */

const CACHE_TTL = 5 * 60 * 1000;
const store = new Map();

export const cache = {
  get(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) { store.delete(key); return null; }
    return entry.data;
  },
  set(key, data) { store.set(key, { data, ts: Date.now() }); },
  invalidate(key) { store.delete(key); },
  invalidateAll() { store.clear(); },
  age(key) { const e = store.get(key); return e ? Date.now() - e.ts : Infinity; },
};

/**
 * useFetch — safe data fetching hook.
 *
 * - Shows cached data INSTANTLY (no spinner) if available
 * - Refreshes silently in the background
 * - NEVER gets stuck in loading=true forever
 * - Handles AbortError (tab switch) gracefully
 */
import { useState, useEffect, useRef } from 'react';

export function useFetch(cacheKey, fetcher) {
  const cached = cache.get(cacheKey);
  const [data, setData]       = useState(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError]     = useState(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;

    // Safety net: never stay in loading=true for more than 40 seconds
    const safetyTimer = setTimeout(() => {
      if (!cancelRef.current) setLoading(false);
    }, 40000);

    const run = async () => {
      // If we have cached data, show it immediately and refresh silently
      const existing = cache.get(cacheKey);
      if (existing) {
        setData(existing);
        setLoading(false);
        // Silent background refresh
        try {
          const fresh = await fetcher();
          if (cancelRef.current) return;
          cache.set(cacheKey, fresh);
          setData(fresh);
        } catch (e) {
          // AbortError or network — keep showing cached data, no error
          if (e.name !== 'AbortError') console.warn(`[cache] Silent refresh failed for ${cacheKey}:`, e?.message);
        }
      } else {
        // No cache — show spinner, fetch, show data
        setLoading(true);
        try {
          const fresh = await fetcher();
          if (cancelRef.current) return;
          cache.set(cacheKey, fresh);
          setData(fresh);
          setError(null);
        } catch (e) {
          if (cancelRef.current) return;
          if (e.name === 'AbortError') {
            // Tab was switched — don't show error, just hide spinner
          } else {
            console.error(`[cache] Fetch failed for ${cacheKey}:`, e?.message);
            setError(e?.message || 'Failed to load');
          }
        } finally {
          if (!cancelRef.current) setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelRef.current = true;
      clearTimeout(safetyTimer);
    };
  }, [cacheKey]);

  const refresh = async () => {
    cache.invalidate(cacheKey);
    setLoading(true);
    try {
      const fresh = await fetcher();
      cache.set(cacheKey, fresh);
      setData(fresh);
      setError(null);
    } catch (e) {
      if (e.name !== 'AbortError') setError(e?.message);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refresh };
}
