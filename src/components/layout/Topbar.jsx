import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, Plus, Bell } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import ThemeToggle from '@/components/gym/ThemeToggle';
import GlobalSearch from '@/components/gym/GlobalSearch';
import { can } from '@/lib/gym';

export default function Topbar({ settings, onMenuClick }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (user?.full_name || '').split(' ')[0];

  return (
    <>
      <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button onClick={onMenuClick} className="lg:hidden text-foreground">
          <Menu className="h-6 w-6" />
        </button>

        <div className="hidden sm:block">
          <p className="text-sm font-semibold text-foreground">{greeting}, <span className="gradient-text font-extrabold">{firstName}</span></p>
          <p className="text-xs text-muted-foreground">{settings?.gym_name || 'DOYEN THE GYM'}</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <Search className="h-4 w-4" />
            <span className="hidden md:inline">Search members…</span>
            <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] md:inline">⌘K</kbd>
          </button>

          {can(user, 'member.create') && (
            <button
              onClick={() => navigate('/members/new')}
              className="inline-flex items-center gap-1.5 rounded-xl btn-primary-gen glow-primary px-3 py-2 text-sm font-semibold transition hover:brightness-110"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Member</span>
            </button>
          )}

          <ThemeToggle />
          <button className="relative hidden h-9 w-9 items-center justify-center rounded-xl border border-border/60 text-foreground hover:bg-muted/60 sm:flex">
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
          </button>
        </div>
      </header>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}