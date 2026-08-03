import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';

import { getSettings, setRolePermissions } from '@/lib/gym';
import { cn } from '@/lib/utils';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout() {
  const [settings, setSettings] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false); // desktop auto-hide mode
  const [revealed, setRevealed] = useState(false);   // hover-revealed while collapsed

  useEffect(() => {
    getSettings().then((s) => { setSettings(s); setRolePermissions(s?.role_permissions); }).catch(() => {});
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