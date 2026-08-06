import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { getSettings, setRolePermissions } from '@/lib/gym';
import { supabase } from '@/api/supabaseClient';
import { cn } from '@/lib/utils';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout() {
  const [settings, setSettings]       = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed]     = useState(false);
  const [revealed, setRevealed]       = useState(false);
  const navigateRef = useRef(null);
  const navigate    = useNavigate();
  navigateRef.current = navigate;

  // Load settings once on mount
  useEffect(() => {
    getSettings()
      .then((s) => { setSettings(s); setRolePermissions(s?.role_permissions); })
      .catch(() => {});
  }, []);

  // Check session every 15 minutes — NO visibilitychange listener.
  // Supabase autoRefreshToken handles token renewal silently.
  // We only check for genuine sign-out (session completely gone).
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) navigateRef.current?.('/login', { replace: true });
      } catch {
        // Network error — don't redirect
      }
    };

    const t = setInterval(checkSession, 15 * 60 * 1000);
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
