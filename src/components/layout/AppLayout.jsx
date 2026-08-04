import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import { getSettings, setRolePermissions } from '@/lib/gym';
import { supabase } from '@/api/supabaseClient';
import { cn } from '@/lib/utils';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout() {
  const [settings, setSettings] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getSettings()
      .then((s) => { setSettings(s); setRolePermissions(s?.role_permissions); })
      .catch(() => {});
  }, []);

  // ── Session keep-alive & idle recovery ─────────────────────────────────────
  useEffect(() => {
    let sessionCheckTimer = null;

    const refreshSession = async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data?.session) {
          // Session is truly gone — redirect to login
          navigate('/login', { replace: true });
        }
      } catch {
        // Network error — don't redirect, user may just be offline briefly
      }
    };

    // When the tab becomes visible again after being hidden (e.g. user switches
    // back, wakes the screen, or returns from another app), refresh the session
    // so the JWT is valid and any stale realtime channels reconnect.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSession();
      }
    };

    // Also check every 10 minutes while the tab is open, in case the token
    // expires without a visibility event (e.g. tab left open overnight).
    const startHeartbeat = () => {
      clearInterval(sessionCheckTimer);
      sessionCheckTimer = setInterval(refreshSession, 10 * 60 * 1000);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    startHeartbeat();

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(sessionCheckTimer);
    };
  }, [navigate]);

  return (
    <div className="relative min-h-screen bg-background">
      <div className="app-ambient" aria-hidden="true" />
      <Sidebar
        settings={settings}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        revealed={revealed}
        onCollapse={() => { setCollapsed(true); setRevealed(false); }}
        onPin={() => { setCollapsed(false); setRevealed(false); }}
        onReveal={() => setRevealed(true)}
        onAutoHide={() => setRevealed(false)}
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