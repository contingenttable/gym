import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { getSettings, setRolePermissions } from '@/lib/gym';
import { supabase } from '@/api/supabaseClient';
import { cn } from '@/lib/utils';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

// How often to ping the DB to prevent the free-tier project from pausing.
// Supabase pauses after 7 days of inactivity — ping every 4 days is safe.
const KEEPALIVE_INTERVAL_MS = 4 * 24 * 60 * 60 * 1000; // 4 days
const SESSION_HEARTBEAT_MS  = 10 * 60 * 1000;           // 10 minutes

export default function AppLayout() {
  const [settings, setSettings]     = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed]   = useState(false);
  const [revealed, setRevealed]     = useState(false);
  const navigate = useNavigate();

  // ── Load settings ──────────────────────────────────────────────────────────
  useEffect(() => {
    getSettings()
      .then((s) => { setSettings(s); setRolePermissions(s?.role_permissions); })
      .catch(() => {});
  }, []);

  // ── Session keep-alive ─────────────────────────────────────────────────────
  // Also fires a lightweight DB ping to prevent the free-tier project from
  // being paused (Supabase pauses after 7 days of no activity).
  useEffect(() => {
    let heartbeatTimer = null;
    let keepaliveTimer = null;

    const refreshSession = async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data?.session) {
          navigate('/login', { replace: true });
        }
      } catch {
        // Network error — don't redirect, user may be briefly offline
      }
    };

    // Lightweight ping: SELECT 1 — keeps the DB connection warm and
    // prevents the project from being paused on the free tier.
    const pingDB = async () => {
      try {
        await supabase.from('settings').select('id').limit(1);
      } catch {
        // Non-fatal — just a keepalive
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshSession();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    // Heartbeat: refresh JWT every 10 minutes while active
    heartbeatTimer = setInterval(refreshSession, SESSION_HEARTBEAT_MS);

    // Keepalive: ping DB every 4 days to prevent free-tier pause
    keepaliveTimer = setInterval(pingDB, KEEPALIVE_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(heartbeatTimer);
      clearInterval(keepaliveTimer);
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
