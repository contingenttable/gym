import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  LayoutDashboard, Users, CalendarCheck, CreditCard, FileBarChart,
  ClipboardList, Settings as SettingsIcon, Dumbbell, LogOut, X, IdCard, UserCog,
  PanelLeftClose, PanelLeftOpen, UserPlus, QrCode, IndianRupee,
} from 'lucide-react';
import { can, ROLES } from '@/lib/gym';
import { cn } from '@/lib/utils';
import { Image } from '@/components/ui/image';

const NAV = [
  { group: 'Operations', items: [
    { label: 'Dashboard', path: '/', perm: null, icon: LayoutDashboard },
    { label: 'Members', path: '/members', perm: 'member.view', icon: Users },
    { label: 'Attendance', path: '/attendance', perm: 'attendance.create', icon: CalendarCheck },
    { label: 'Payments', path: '/payments', perm: 'payment.view', icon: CreditCard },
    { label: 'Reports', path: '/reports', perm: 'report.view', icon: FileBarChart },
  ]},
  { group: 'Administration', items: [
    { label: 'Plans', path: '/plans', perm: 'settings.view', icon: IdCard },
    { label: 'Users & Roles', path: '/users', perm: 'settings.view', icon: UserCog },
    { label: 'Audit Log', path: '/audit', perm: 'audit.view', icon: ClipboardList },
    { label: 'Settings', path: '/settings', perm: 'settings.view', icon: SettingsIcon },
  ]},
];

const QUICK = [
  { label: 'Add Member', short: 'Add', path: '/members/new', perm: 'member.create', icon: UserPlus },
  { label: 'Scan Attendance', short: 'Scan', path: '/attendance', perm: 'attendance.create', icon: QrCode },
  { label: 'Record Payment', short: 'Pay', path: '/payments', perm: 'payment.create', icon: IndianRupee },
];

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');
}

export default function Sidebar({ settings, open, onClose, collapsed, revealed, onCollapse, onPin, onReveal, onAutoHide }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const role = user?.role || 'reception';
  const gymName = settings?.gym_name || 'DOYEN THE GYM';

  const isActive = (path) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  const visibleNav = NAV
    .map((s) => ({ ...s, items: s.items.filter((it) => !it.perm || can(user, it.perm)) }))
    .filter((s) => s.items.length);
  const quick = QUICK.filter((q) => can(user, q.perm));
  const flatItems = visibleNav.flatMap((s) => s.items);

  return (
    <>
      {/* Mobile overlay */}
      <div className={cn('fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm lg:hidden', open ? 'block' : 'hidden')} onClick={onClose} />

      {/* Mini rail (desktop, collapsed mode) — always present; covered by full overlay when revealed */}
      {collapsed && (
        <aside
          onMouseEnter={onReveal}
          className="glass-sidebar fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col items-center py-4 lg:flex"
        >
          <div className="mb-5">
            {settings?.logo ? (
              <Image src={settings.logo} alt={`${gymName} logo`} fittingType="fill" className="h-10 w-10 rounded-full shadow-lg ring-1 ring-primary/30" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl grad-brand glow-primary text-primary-foreground shadow-lg">
                <Dumbbell className="h-5 w-5" />
              </div>
            )}
          </div>

          <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto scrollbar-thin">
            {quick.map((q) => (
              <button key={q.label} title={q.label} onClick={() => { onClose(); navigate(q.path); }}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-primary/10 hover:text-primary">
                <q.icon className="h-[18px] w-[18px]" />
              </button>
            ))}
            {quick.length > 0 && <div className="my-1.5 h-px w-8 bg-sidebar-border/60" />}
            {flatItems.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;
              return (
                <Link key={item.path} to={item.path} title={item.label} onClick={onClose}
                  className={cn('flex h-10 w-10 items-center justify-center rounded-xl transition',
                    active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground')}>
                  <Icon className="h-[18px] w-[18px]" />
                </Link>
              );
            })}
          </nav>

          <div className="mt-2 flex flex-col items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary" title={user?.full_name || user?.email}>
              {initials(user?.full_name || user?.email)}
            </div>
            <button onClick={logout} title="Logout"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </aside>
      )}

      {/* Full sidebar */}
      <aside
        onMouseLeave={() => { if (collapsed && revealed) onAutoHide?.(); }}
        className={cn(
          'glass-sidebar fixed inset-y-0 left-0 z-50 flex w-72 flex-col transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full',
          !collapsed ? 'lg:translate-x-0' : revealed ? 'lg:translate-x-0' : 'lg:-translate-x-full'
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5">
          {settings?.logo ? (
            <Image src={settings.logo} alt={`${gymName} logo`} fittingType="fill" className="h-10 w-10 shrink-0 rounded-full shadow-lg ring-1 ring-primary/30" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl grad-brand glow-primary text-primary-foreground shadow-lg">
              <Dumbbell className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-heading text-base font-bold leading-tight text-foreground truncate">{gymName}</p>
            <p className="text-xs text-muted-foreground">Management System</p>
          </div>
          <button onClick={onClose} className="lg:hidden text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
          {!collapsed ? (
            <button onClick={onCollapse} aria-label="Collapse sidebar"
              className="hidden rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground lg:block">
              <PanelLeftClose className="h-5 w-5" />
            </button>
          ) : (
            <button onClick={onPin} aria-label="Pin sidebar open"
              className="hidden rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground lg:block">
              <PanelLeftOpen className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-4">
          {/* Quick actions */}
          {quick.length > 0 && (
            <div className="mb-4">
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quick</p>
              <div className="grid grid-cols-3 gap-1.5">
                {quick.map((q) => {
                  const Icon = q.icon;
                  return (
                    <button key={q.label} title={q.label} onClick={() => { onClose(); navigate(q.path); }}
                      className="flex flex-col items-center gap-1 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/40 px-1 py-2.5 text-[10px] font-medium text-sidebar-foreground transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary">
                      <Icon className="h-[18px] w-[18px]" />
                      <span className="truncate">{q.short}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {visibleNav.map((section) => (
            <div key={section.group} className="mb-5">
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{section.group}</p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.path);
                  const Icon = item.icon;
                  return (
                    <li key={item.path} className="relative">
                      {active && <span className="absolute left-0 top-1/2 h-7 w-1.5 -translate-y-1/2 rounded-r-full grad-brand glow-primary" />}
                      <Link to={item.path} onClick={onClose}
                        className={cn('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                          active ? 'bg-primary/10 font-semibold text-primary' : 'text-sidebar-foreground hover:bg-sidebar-accent')}>
                        <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-sidebar-border/60 p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {initials(user?.full_name || user?.email)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{user?.full_name || user?.email}</p>
              <p className="truncate text-xs text-muted-foreground">{ROLES[role]}</p>
            </div>
            <button onClick={logout} aria-label="Logout"
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}