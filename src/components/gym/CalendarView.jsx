import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CalendarDays, Flame } from 'lucide-react';
import { formatDate, daysRemaining } from '@/lib/gym';
import MemberAvatar from '@/components/gym/MemberAvatar';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function CalendarView({ attendance = [], memberships = [], memberMap = {} }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });

  const { attendanceByDate, expiringByDate, maxAtt } = useMemo(() => {
    const attendanceByDate = {};
    for (const a of attendance) {
      if (!a.date) continue;
      attendanceByDate[a.date] = (attendanceByDate[a.date] || 0) + 1;
    }
    const expiringByDate = {};
    for (const m of memberships) {
      if (m.status === 'cancelled' || !m.end_date) continue;
      (expiringByDate[m.end_date] = expiringByDate[m.end_date] || []).push(m);
    }
    const year = cursor.getFullYear(), month = cursor.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    let maxAtt = 0;
    for (let i = 1; i <= days; i++) {
      maxAtt = Math.max(maxAtt, attendanceByDate[toISO(new Date(year, month, i))] || 0);
    }
    return { attendanceByDate, expiringByDate, maxAtt };
  }, [attendance, memberships, cursor]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = toISO(new Date());

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: d, iso: toISO(new Date(year, month, d)) });

  const upcomingExpiring = memberships
    .filter((m) => m.status !== 'cancelled' && m.end_date && new Date(m.end_date) >= new Date(todayStr))
    .sort((a, b) => new Date(a.end_date) - new Date(b.end_date))
    .slice(0, 8);

  const intensity = (count) => (maxAtt > 0 ? 0.14 + 0.8 * (count / maxAtt) : 0);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Calendar */}
      <div className="glass-card rounded-2xl p-5 lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-base font-bold text-foreground">
              {cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="rounded-lg border border-border/60 p-1.5 text-foreground hover:bg-muted/60" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }} className="rounded-lg border border-border/60 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/60">Today</button>
            <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="rounded-lg border border-border/60 p-1.5 text-foreground hover:bg-muted/60" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-muted-foreground">
          {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((c, idx) => {
            if (!c) return <div key={idx} className="aspect-square" />;
            const count = attendanceByDate[c.iso] || 0;
            const exp = expiringByDate[c.iso] || [];
            const isToday = c.iso === todayStr;
            return (
              <div
                key={idx}
                className="relative flex aspect-square flex-col items-center justify-center rounded-lg border border-border/50 text-xs"
                style={count > 0 ? { backgroundColor: `hsl(var(--primary) / ${intensity(count)})` } : undefined}
                title={count > 0 ? `${count} check-in${count > 1 ? 's' : ''}` : ''}
              >
                <span className={`font-semibold ${count > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>{c.date}</span>
                {count > 0 && <span className="text-[10px] text-muted-foreground">{count}</span>}
                {exp.length > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-card" title={`${exp.length} membership${exp.length > 1 ? 's' : ''} expiring`} />
                )}
                {isToday && <span className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-primary" />}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded" style={{ backgroundColor: 'hsl(var(--primary) / 0.14)' }} />
            <span>low</span>
            <span className="h-3 w-3 rounded" style={{ backgroundColor: 'hsl(var(--primary) / 0.5)' }} />
            <span className="h-3 w-3 rounded" style={{ backgroundColor: 'hsl(var(--primary) / 0.94)' }} />
            <span>check-ins</span>
          </div>
          <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> membership expiry</div>
          <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded ring-2 ring-primary" /> today</div>
        </div>
      </div>

      {/* Upcoming expirations */}
      <div className="glass-card rounded-2xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <Flame className="h-5 w-5 text-amber-500" />
          <h3 className="font-heading text-base font-bold text-foreground">Upcoming Expirations</h3>
        </div>
        {upcomingExpiring.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No upcoming expirations.</p>
        ) : (
          <ul className="space-y-2">
            {upcomingExpiring.map((m) => {
              const member = memberMap[m.member_id];
              const days = daysRemaining(m.end_date);
              return (
                <li key={m.id}>
                  <Link to={`/members/${m.member_id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60">
                    <MemberAvatar member={member} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{member?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{m.plan_name} · {formatDate(m.end_date)}</p>
                    </div>
                    <span className={`text-xs font-semibold ${days <= 3 ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`}>{days}d</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}