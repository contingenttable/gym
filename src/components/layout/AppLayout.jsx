import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { getSettings, setRolePermissions } from '@/lib/gym';
import { supabase } from '@/api/supabaseClient';
import { cache } from '@/lib/dataCache';
import { cn } from '@/lib/utils';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout() {
  const [settings, setSettings]       = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed]     = useState(false);
  const [revealed, setRevealed]       = useState(false);

  const navigateRef     = useRef(null);
  const reconnectingRef = useRef(false);  // prevent concurrent reconnects
  const navigate        = useNavigate();
  navigateRef.current   = navigate;

  // ── Load settings once ─────────────────────────────────────────────────────
  useEffect(() => {
    getSettings()
      .then((s) => { setSettings(s); setRolePermissions(s?.role_permissions); })
      .catch(() => {});
  }, []);

  // ── Recovery function — called on tab focus & network reconnect ─────────────
  // This is the core fix: after any absence (tab switch, sleep, network drop),
  // we check if the session is still valid and if the DB is reachable.
  // If not — we recover silently without showing a spinner.
  const recover = useCallback(async () => {
    if (reconnectingRef.current) return;  // already recovering
    reconnectingRef.current = true;

    try {
      // 1. Check session — getSession() reads from localStorage, no network call
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        // No session — send to login
        navigateRef.current?.('/login', { replace: true });
        return;
      }

      // 2. Check if token needs refresh (expires within 10 minutes)
      const expiresAt = (session.expires_at || 0) * 1000;
      const timeLeft  = expiresAt - Date.now();

      if (timeLeft < 10 * 60 * 1000) {
        try {
          const { error } = await supabase.auth.refreshSession();
          if (error) {
            // Real auth failure — go to login
            navigateRef.current?.('/login', { replace: true });
            return;
          }
        } catch {
          // Network error — token still valid, don't redirect
        }
      }

      // 3. Invalidate stale cache so pages re-fetch fresh data silently
      // (data older than 2 min is already auto-expired by dataCache.js)
      // Force-invalidate attendance since it changes most frequently
      cache.invalidate('attendance');

    } finally {
      reconnectingRef.current = false;
    }
  }, []);

  // ── Visibility change — fires on tab switch ─────────────────────────────────
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') recover();
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [recover]);

  // ── Online event — fires when network reconnects ────────────────────────────
  useEffect(() => {
    const onOnline = () => {
      console.log('[app] Network reconnected — recovering session');
      recover();
    };

    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [recover]);

  // ── Periodic heartbeat — every 10 min while active ─────────────────────────
  useEffect(() => {
    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible') recover();
    }, 10 * 60 * 1000);
    return () => clearInterval(heartbeat);
  }, [recover]);

  return (
    <div className="relative min-h-screen bg-background">
      <div className="app-ambient" aria-hidden="true" />
      <Sidebar
        settings={settings}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        revealed={revealed}
        onCollapse={() => { setCollapsed(true);  setRevealed(false); }}
        onPin={()      => { setCollapsed(false); setRevealed(false); }}
        onReveal={()   => setRevealed(true)}
        onAutoHide={()  => setRevealed(false)}
      />
      <div className={cn('relative z-10', collapsed ? 'lg:pl-[76px]' : 'lg:pl-72')}>
        <Topbar settings={settings} onMenuClick={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet context={{ settings, setSettings }} />
        </main>
      </div>
    </div>
  );
}
