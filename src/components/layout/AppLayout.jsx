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

  const navigateRef   = useRef(null);
  const navigate      = useNavigate();
  navigateRef.current = navigate;

  // ── Load settings once ─────────────────────────────────────────────────────
  useEffect(() => {
    getSettings()
      .then((s) => { setSettings(s); setRolePermissions(s?.role_permissions); })
      .catch(() => {});
  }, []);

  // ── Visibility change handler ──────────────────────────────────────────────
  useEffect(() => {
    let lastHidden = 0;

    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        lastHidden = Date.now();
      }
    };

    const onShow = async () => {
      if (document.visibilityState !== 'visible') return;
      const hiddenMs = Date.now() - lastHidden;

      // If tab was hidden for more than 30 seconds, invalidate cache so
      // pages re-fetch fresh data when they re-render.
      if (hiddenMs > 30000) {
        cache.invalidateAll();
      }

      // Check session is still valid
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          navigateRef.current?.('/login', { replace: true });
          return;
        }
        // Refresh token if expiring within 5 minutes
        const expiresAt = (session.expires_at || 0) * 1000;
        if (expiresAt - Date.now() < 5 * 60 * 1000) {
          await supabase.auth.refreshSession().catch(() => {});
        }
      } catch {
        // Network error — don't redirect
      }
    };

    document.addEventListener('visibilitychange', onHide);
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('online', onShow);

    return () => {
      document.removeEventListener('visibilitychange', onHide);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('online', onShow);
    };
  }, []);

  // ── 10-min heartbeat ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) navigateRef.current?.('/login', { replace: true });
      } catch {}
    }, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

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
