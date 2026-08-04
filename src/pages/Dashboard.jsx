import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useNavigate } from 'react-router-dom';

import {
  Users, UserCheck, CalendarCheck, AlertTriangle, XCircle, IndianRupee,
  TrendingUp, QrCode, RefreshCw, ArrowRight, Clock,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import KpiCard from '@/components/gym/KpiCard';
import { Button } from '@/components/ui/button';
import MemberAvatar from '@/components/gym/MemberAvatar';
import StatusBadge from '@/components/gym/StatusBadge';
import EmptyState from '@/components/gym/EmptyState';
import AnalyticsPanel from '@/components/gym/AnalyticsPanel';
import RetentionChart from '@/components/gym/RetentionChart';
import CalendarView from '@/components/gym/CalendarView';
import TopMembersLeaderboard from '@/components/gym/TopMembersLeaderboard';
import UpcomingBirthdays from '@/components/gym/UpcomingBirthdays';
import WakingUp from '@/components/gym/WakingUp';
import { cache } from '@/lib/dataCache';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  deriveStatus, formatCurrency, formatDate, formatDateTime, daysRemaining,
  PAYMENT_MODE_LABEL, can,
} from '@/lib/gym';
import { useAuth } from '@/lib/AuthContext';

export default function Dashboard() {
  const { settings } = useOutletContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!cache.get('dashboard')); // no spinner if cached
  const [data, setData]       = useState(cache.get('dashboard'));

  useEffect(() => {
    const CACHE_KEY = 'dashboard';
    let cancelled   = false;

    const fetchData = async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [members, memberships, payments, attendance] = await Promise.all([
          db.entities.Member.list('-created_date', 1000),
          db.entities.Membership.list('-created_date', 1000),
          db.entities.Payment.list('-created_date', 500),
          db.entities.Attendance.list('-created_date', 500),
        ]);
        if (cancelled) return;
        const fresh = { members, memberships, payments, attendance };
        cache.set(CACHE_KEY, fresh);
        setData(fresh);
      } catch (e) {
        console.error('Dashboard load failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const cached = cache.get(CACHE_KEY);
    if (cached) {
      // Show cached data immediately, refresh silently in background
      setData(cached);
      setLoading(false);
      fetchData(true);
    } else {
      fetchData(false);
    }

    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const { members, memberships, payments, attendance } = data;
    const warningDays = settings?.expiry_warning_days ?? 7;
    const symbol = settings?.currency_symbol || '₹';
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();

    // latest membership per member
    const latestByMember = {};
    for (const m of memberships) {
      const cur = latestByMember[m.member_id];
      if (!cur || new Date(m.end_date) > new Date(cur.end_date)) latestByMember[m.member_id] = m;
    }
    let active = 0, expiring = 0, expired = 0, frozen = 0;
    const expiringMembers = [];
    const expiredMembers = [];
    for (const m of Object.values(latestByMember)) {
      const s = deriveStatus(m, warningDays);
      if (s === 'active') active++;
      else if (s === 'expiring_soon') { expiring++; expiringMembers.push(m); }
      else if (s === 'expired') { expired++; expiredMembers.push(m); }
      else if (s === 'frozen') frozen++;
    }

    const todayAttendance = attendance.filter((a) => a.date === today);
    const uniqueToday = new Set(todayAttendance.map((a) => a.member_id)).size;

    const activePayments = payments.filter((p) => p.status !== 'voided');
    const todayCollection = activePayments.filter((p) => p.payment_date === today).reduce((s, p) => s + Number(p.amount || 0), 0);
    const monthCollection = activePayments
      .filter((p) => { const d = new Date(p.payment_date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
      .reduce((s, p) => s + Number(p.amount || 0), 0);

    // pending dues
    let pendingDues = 0;
    for (const m of Object.values(latestByMember)) {
      if (m.status === 'cancelled') continue;
      const paid = activePayments.filter((p) => p.membership_id === m.id).reduce((s, p) => s + Number(p.amount || 0), 0);
      const bal = Math.max(0, Number(m.fee || 0) - paid);
      if (bal > 0) pendingDues += bal;
    }

    // attendance last 7 days
    const days7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const count = attendance.filter((a) => a.date === ds).length;
      days7.push({ day: d.toLocaleDateString('en-IN', { weekday: 'short' }), checkins: count });
    }

    const recentPayments = [...activePayments].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 6);
    const recentCheckins = [...attendance].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 6);

    const memberMap = {};
    for (const m of members) memberMap[m.id] = m;

    expiringMembers.sort((a, b) => daysRemaining(a.end_date) - daysRemaining(b.end_date));

    return {
      totalMembers: members.length,
      active, expiring, expired, frozen,
      todayCheckins: todayAttendance.length,
      uniqueToday,
      todayCollection, monthCollection, pendingDues,
      days7, recentPayments, recentCheckins, memberMap,
      expiringMembers: expiringMembers.slice(0, 6),
      symbol,
    };
  }, [data, settings]);

  if (loading) {
    return (
      <>
        <WakingUp loading={loading} />
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
        </div>
      </>
    );
  }

  if (!stats) {
    return <EmptyState icon={XCircle} title="Couldn't load dashboard" description="Please try again in a moment." />;
  }

  const firstName = (user?.full_name || 'there').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayDate = formatDate(new Date().toISOString().slice(0, 10));
  const tdy = stats.days7[6]?.checkins ?? 0;
  const yst = stats.days7[5]?.checkins ?? 0;
  const diff = tdy - yst;
  const checkinTrend = (tdy === 0 && yst === 0)
    ? undefined
    : { dir: diff >= 0 ? 'up' : 'down', text: diff === 0 ? 'same as yesterday' : `${diff > 0 ? '+' : ''}${diff} vs yesterday` };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5 space-y-6">
          {/* Greeting + quick actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {greeting}, <span className="gradient-text">{firstName}</span>
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{todayDate}</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {can(user, 'attendance.create') && (
                <Button asChild variant="outline" size="lg" className="rounded-xl">
                  <Link to="/attendance"><QrCode className="h-4 w-4" /> Scan Attendance</Link>
                </Button>
              )}
              {can(user, 'payment.create') && (
                <Button asChild variant="outline" size="lg" className="rounded-xl">
                  <Link to="/payments"><IndianRupee className="h-4 w-4" /> Record Payment</Link>
                </Button>
              )}
              {can(user, 'membership.renew') && (
                <Button asChild variant="outline" size="lg" className="rounded-xl">
                  <Link to="/members"><RefreshCw className="h-4 w-4" /> Renew Membership</Link>
                </Button>
              )}
            </div>
          </div>

          {/* Primary KPIs */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard to="/members?status=active" label="Active Members" value={stats.active} sub={`${stats.frozen} frozen · ${stats.totalMembers} total`} icon={UserCheck} tone="primary" className="sm:p-6" />
            <KpiCard to="/attendance" label="Today's Check-ins" value={stats.uniqueToday} sub={`${stats.todayCheckins} total`} icon={CalendarCheck} tone="accent" trend={checkinTrend} className="sm:p-6" />
            <KpiCard to="/payments?date=today" label="Today's Collection" value={formatCurrency(stats.todayCollection, stats.symbol)} sub={`This month ${formatCurrency(stats.monthCollection, stats.symbol)}`} icon={IndianRupee} tone="primary" className="sm:p-6" />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <KpiCard to="/members" label="Total Members" value={stats.totalMembers} icon={Users} tone="info" />
            <KpiCard to="/members?status=expiring_soon" label="Expiring Soon" value={stats.expiring} sub={`${stats.expired} expired`} icon={AlertTriangle} tone="warning" />
            <KpiCard to="/members?status=dues" label="Pending Dues" value={formatCurrency(stats.pendingDues, stats.symbol)} icon={TrendingUp} tone="danger" />
            <KpiCard to="/payments?date=month" label="This Month" value={formatCurrency(stats.monthCollection, stats.symbol)} icon={IndianRupee} tone="accent" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Attendance chart */}
            <div className="glass-card rounded-2xl p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-heading text-base font-bold text-foreground">Attendance Trend</h3>
                  <p className="text-xs text-muted-foreground">Check-ins over the last 7 days</p>
                </div>
                <CalendarCheck className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.days7} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                    />
                    <Bar dataKey="checkins" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Expiring soon */}
            <div className="glass-card rounded-2xl p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-heading text-base font-bold text-foreground">Expiring Soon</h3>
                <Link to="/members" className="text-xs font-medium text-primary hover:underline">View all</Link>
              </div>
              {stats.expiringMembers.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No memberships expiring soon.</p>
              ) : (
                <ul className="space-y-2">
                  {stats.expiringMembers.map((m) => {
                    const member = stats.memberMap[m.member_id];
                    const days = daysRemaining(m.end_date);
                    return (
                      <li key={m.id}>
                        <Link to={`/members/${m.member_id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60">
                          <MemberAvatar member={member} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{member?.full_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{m.plan_name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">{days}d left</p>
                            <p className="text-[11px] text-muted-foreground">{formatDate(m.end_date)}</p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Recent payments */}
            <div className="glass-card rounded-2xl p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-heading text-base font-bold text-foreground">Recent Payments</h3>
                <Link to="/payments" className="text-xs font-medium text-primary hover:underline">View all</Link>
              </div>
              {stats.recentPayments.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <ul className="space-y-1">
                  {stats.recentPayments.map((p) => {
                    const member = stats.memberMap[p.member_id];
                    return (
                      <li key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60">
                        <MemberAvatar member={member} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{member?.full_name || p.member_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{PAYMENT_MODE_LABEL[p.mode]} · {formatDate(p.payment_date)}</p>
                        </div>
                        <p className="text-sm font-bold text-foreground">{formatCurrency(p.amount, stats.symbol)}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Recent check-ins */}
            <div className="glass-card rounded-2xl p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-heading text-base font-bold text-foreground">Recent Check-ins</h3>
                <Link to="/attendance" className="text-xs font-medium text-primary hover:underline">View all</Link>
              </div>
              {stats.recentCheckins.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No check-ins recorded yet.</p>
              ) : (
                <ul className="space-y-1">
                  {stats.recentCheckins.map((a) => {
                    const member = stats.memberMap[a.member_id];
                    return (
                      <li key={a.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60">
                        <MemberAvatar member={member} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{member?.full_name || a.member_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{a.method === 'qr' ? 'QR scan' : 'Search'}</p>
                        </div>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /> {formatDateTime(a.timestamp).split(',')[1]?.trim()}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Upcoming birthdays */}
          <UpcomingBirthdays members={data.members} />

          {/* Top members leaderboard */}
          <TopMembersLeaderboard attendance={data.attendance} memberMap={stats.memberMap} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-5">
          <CalendarView attendance={data.attendance} memberships={data.memberships} memberMap={stats.memberMap} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-5 space-y-5">
          <RetentionChart memberships={data.memberships} />
          <AnalyticsPanel attendance={data.attendance} />
        </TabsContent>
      </Tabs>
    </div>
  );
}