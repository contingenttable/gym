import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { getSettings, setRolePermissions } from '@/lib/gym';
import { supabase } from '@/api/supabaseClient';
import { cn } from '@/lib/utils';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const SESSION_HEARTBEAT_MS = 10 * 60 * 1000; // 10 min

export default function AppLayout() {
  const [settings, setSettings]       = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed]     = useState(false);
  const [revealed, setRevealed]       = useState(false);

  // Use a ref for navigate so the session effect never needs to re-run
  const navigateRef = useRef(null);
  const navigate    = useNavigate();
  navigateRef.current = navigate;

  // ── Load settings once ─────────────────────────────────────────────────────
  useEffect(() => {
    getSettings()
      .then((s) => { setSettings(s); setRolePermissions(s?.role_permissions); })
      .catch(() => {});
  }, []);

  // ── Session heartbeat ──────────────────────────────────────────────────────
  // No navigate in deps — uses ref so this effect runs exactly ONCE.
  // Does NOT call refreshSession() on visibility change — that was the
  // cause of repeated SIGNED_IN events → repeated re-renders on tab switch.
  useEffect(() => {
    let lastRefresh = 0;
    const MIN_REFRESH_GAP = 60 * 1000; // don't refresh more than once per minute

    const safeRefresh = async () => {
      const now = Date.now();
      // Debounce: skip if we refreshed very recently
      if (now - lastRefresh < MIN_REFRESH_GAP) return;
      lastRefresh = now;

      try {
        const { error } = await supabase.auth.refreshSession();
        if (error) {
          // Only redirect if it's a real auth error, not a network hiccup
          if (error.status === 401 || error.message?.includes('invalid')) {
            navigateRef.current?.('/login', { replace: true });
          }
        }
      } catch {
        // Network error — don't redirect
      }
    };

    // Only refresh on visibility if the token is actually close to expiring.
    // Check expiry first — avoids unnecessary refreshes on every tab switch.
    const onVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const expiresAt = session.expires_at * 1000; // convert to ms
        const timeLeft  = expiresAt - Date.now();
        // Only refresh if token expires within 5 minutes
        if (timeLeft < 5 * 60 * 1000) {
          await safeRefresh();
        }
        // Otherwise Supabase's autoRefreshToken handles it silently
      } catch {}
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    // Periodic heartbeat — much safer than on every tab switch
    const heartbeat = setInterval(safeRefresh, SESSION_HEARTBEAT_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(heartbeat);
    };
  }, []); // ← empty deps — runs once, uses ref for navigate

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
