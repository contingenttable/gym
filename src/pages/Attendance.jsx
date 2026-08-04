import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

import {
  Search, ScanLine, CalendarCheck, Users, Clock, TrendingUp, CheckCircle2, QrCode,
  LogOut, Timer,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AnimatePresence } from 'framer-motion';
import KpiCard from '@/components/gym/KpiCard';
import MemberAvatar from '@/components/gym/MemberAvatar';
import StatusBadge from '@/components/gym/StatusBadge';
import EmptyState from '@/components/gym/EmptyState';
import QrScanner from '@/components/gym/QrScanner';
import CheckInQrPanel from '@/components/gym/CheckInQrPanel';
import CheckInOutBurst from '@/components/gym/CheckInOutBurst';
import {
  deriveStatus, formatDate, formatDateTime, daysRemaining, todayISO, logAudit,
  isActiveCheckin, checkOutDue, autoCheckoutTime, formatDuration, sessionDuration,
  resolveActiveCheckin, checkoutMember,
} from '@/lib/gym';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

export default function Attendance() {
  const { settings } = useOutletContext();
  const { toast } = useToast();
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [present, setPresent] = useState(null); // { member, active, mode }
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(null);

  const threshold = settings?.attendance_duplicate_threshold ?? 240;

  const loadAll = async () => {
    try {
      const [m, ms, att] = await Promise.all([
        db.entities.Member.list('-created_date', 1000),
        db.entities.Membership.list('-created_date', 1000),
        db.entities.Attendance.list('-created_date', 500),
      ]);
      setMembers(m);
      setMemberships(ms);
      setAttendance(att);

      // Auto check-out any open check-in that has crossed the threshold.
      const stale = att.filter((a) => checkOutDue(a, threshold));
      if (stale.length) {
        for (const a of stale) {
          try {
            await db.entities.Attendance.update(a.id, {
              checkout_timestamp: autoCheckoutTime(a, threshold),
              check_out_method: 'auto',
            });
          } catch (e) {}
        }
        const fresh = await db.entities.Attendance.list('-created_date', 500);
        setAttendance(fresh);
      }
    } catch (e) {
      console.error('Attendance loadAll failed:', e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadAll(); }, []);

  const todayList = useMemo(
    () => attendance.filter((a) => a.date === todayISO()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    [attendance]
  );

  const latestByMember = useMemo(() => {
    const map = {};
    for (const m of memberships) {
      const cur = map[m.member_id];
      if (!cur || new Date(m.end_date) > new Date(cur.end_date)) map[m.member_id] = m;
    }
    return map;
  }, [memberships]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return members.filter((m) =>
      (m.full_name || '').toLowerCase().includes(q) ||
      (m.member_id || '').toLowerCase().includes(q) ||
      (m.mobile || '').includes(q)
    ).slice(0, 8);
  }, [members, query]);

  // Resolve whether the member is currently in the gym; auto-checkout if overdue.
  const presentMember = async (member) => {
    const active = await resolveActiveCheckin(member.id, threshold);
    setPresent({ member, active, mode: active ? 'out' : 'in' });
  };

  const handleScan = async (token) => {
    // First try the in-memory list (fast path)
    let member = members.find((m) => m.qr_token === token);

    // If not found in cache, re-fetch from DB in case the list is stale
    // (e.g. member was added after this page loaded)
    if (!member) {
      try {
        const fresh = await db.entities.Member.filter({ qr_token: token });
        member = fresh?.[0] || null;
        if (member) {
          // Update local cache so subsequent lookups are fast
          setMembers((prev) => {
            const exists = prev.some((m) => m.id === member.id);
            return exists ? prev : [member, ...prev];
          });
        }
      } catch { /* ignore — fall through to not-found toast */ }
    }

    if (!member) {
      toast({ title: 'Member not found', description: 'This QR is not linked to a member.', variant: 'destructive' });
      return;
    }
    presentMember(member);
  };

  const doCheckIn = async (member, method) => {
    setBusy(true);
    try {
      // Record only uniques — never create a second open session for the same member.
      const active = await resolveActiveCheckin(member.id, threshold);
      if (active) {
        toast({
          title: 'Already checked in',
          description: `${member.full_name} already has an active session — check them out instead.`,
        });
        setPresent({ member, active, mode: 'out' });
        setBusy(false);
        return;
      }
      const now = new Date();
      const rec = await db.entities.Attendance.create({
        member_id: member.id,
        member_name: member.full_name,
        timestamp: now.toISOString(),
        date: now.toISOString().slice(0, 10),
        method,
        correction_status: 'none',
      });
      await logAudit({ action: 'attendance.create', entity: 'Attendance', entity_id: rec.id, reason: `Check-in via ${method}` });
      setBurst({ mode: 'in', name: member.full_name, time: formatDateTime(now.toISOString()).split(',')[1]?.trim() });
      setPresent(null); setQuery('');
      await loadAll();
    } catch (e) {
      toast({ title: 'Check-in failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const doCheckOut = async (member) => {
    setBusy(true);
    try {
      const now = new Date();
      const closed = await checkoutMember(member.id, 'manual', threshold);
      if (!closed) {
        toast({ title: 'No active session', description: `${member.full_name} is not currently checked in.` });
        setPresent(null);
        setBusy(false);
        return;
      }
      await logAudit({ action: 'attendance.update', entity: 'Attendance', entity_id: closed.id, reason: 'Manual check-out' });
      const mins = sessionDuration(closed);
      setBurst({
        mode: 'out', name: member.full_name,
        time: formatDateTime(now.toISOString()).split(',')[1]?.trim(),
        duration: formatDuration(mins),
      });
      setPresent(null);
      await loadAll();
    } catch (e) {
      toast({ title: 'Check-out failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const uniqueToday = new Set(todayList.map((a) => a.member_id)).size;
  const inGymNow = todayList.filter((a) => isActiveCheckin(a) && !checkOutDue(a, threshold)).length;
  const peakHour = useMemo(() => {
    const hours = {};
    todayList.forEach((a) => { const h = new Date(a.timestamp).getHours(); hours[h] = (hours[h] || 0) + 1; });
    const peak = Object.entries(hours).sort((a, b) => b[1] - a[1])[0];
    if (!peak) return '—';
    const h = Number(peak[0]);
    return h < 12 ? `${h || 12} AM` : `${h - 12 || 12} PM`;
  }, [todayList]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CalendarCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground">Fast check-in & check-out for reception</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Today's Check-ins" value={uniqueToday} icon={CalendarCheck} tone="primary" />
        <KpiCard label="In Gym Now" value={inGymNow} icon={Users} tone="info" />
        <KpiCard label="Peak Time" value={peakHour} icon={TrendingUp} tone="accent" />
        <KpiCard label="Latest" value={todayList[0] ? formatDateTime(todayList[0].timestamp).split(',')[1]?.trim() : '—'} icon={Clock} tone="warning" />
      </div>

      <Tabs defaultValue="search" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="search"><Search className="mr-1.5 h-4 w-4" /> Search</TabsTrigger>
          <TabsTrigger value="scan"><ScanLine className="mr-1.5 h-4 w-4" /> QR Scan</TabsTrigger>
          <TabsTrigger value="self"><QrCode className="mr-1.5 h-4 w-4" /> Self Check-in</TabsTrigger>
        </TabsList>

        {/* Search check-in */}
        <TabsContent value="search" className="mt-4">
          <div className="glass-card rounded-2xl p-5">
            {present ? (
              <PresentCard
                present={present}
                membership={latestByMember[present.member.id]}
                settings={settings}
                busy={busy}
                onCancel={() => setPresent(null)}
                onCheckIn={() => doCheckIn(present.member, 'search')}
                onCheckOut={() => doCheckOut(present.member, present.active)}
              />
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type name, member ID or mobile…" className="pl-9 h-12 text-base" />
                </div>
                {query.trim().length >= 2 && (
                  <div className="mt-3">
                    {searchResults.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">No matches. <Link to="/members/new" className="text-primary hover:underline">Register new member</Link></p>
                    ) : (
                      <ul className="space-y-1">
                        {searchResults.map((m) => {
                          const mem = latestByMember[m.id];
                          const st = mem ? deriveStatus(mem, settings?.expiry_warning_days ?? 7) : 'expired';
                          return (
                            <li key={m.id}>
                              <button onClick={() => presentMember(m)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-muted/60">
                                <MemberAvatar member={m} size="sm" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-foreground">{m.full_name}</p>
                                  <p className="text-xs text-muted-foreground">{m.member_id} · {m.mobile}</p>
                                </div>
                                <StatusBadge status={st} />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
                {query.trim().length < 2 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">Start typing to find a member for check-in.</p>
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* QR scan */}
        <TabsContent value="scan" className="mt-4">
          <div className="glass-card rounded-2xl p-5">
            {present ? (
              <PresentCard
                present={present}
                membership={latestByMember[present.member.id]}
                settings={settings}
                busy={busy}
                onCancel={() => setPresent(null)}
                onCheckIn={() => doCheckIn(present.member, 'qr')}
                onCheckOut={() => doCheckOut(present.member, present.active)}
              />
            ) : (
              <div className="mx-auto max-w-md space-y-3">
                <p className="text-center text-sm text-muted-foreground">Point the camera at the member's QR card.</p>
                <QrScanner onDetect={handleScan} />
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <QrCode className="h-4 w-4" /> The QR contains an opaque token — no personal data is exposed.
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Self check-in QR */}
        <TabsContent value="self" className="mt-4">
          <CheckInQrPanel settings={settings} />
        </TabsContent>
      </Tabs>

      {/* Today's sessions */}
      <div className="glass-card rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-heading text-base font-bold text-foreground">
            Today's Sessions
            <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary tnum align-middle">{todayList.length}</span>
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {inGymNow > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> {inGymNow} in gym
              </span>
            )}
            {formatDate(todayISO())} · auto @ {threshold}m
          </div>
        </div>
        {todayList.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="No check-ins today" description="Use search or QR scan above to check in your first member." />
        ) : (
          <div className="divide-y divide-border/60">
            {todayList.map((a) => {
              const member = members.find((m) => m.id === a.member_id);
              const mem = member ? latestByMember[member.id] : null;
              const open = isActiveCheckin(a);
              const overdue = open && checkOutDue(a, threshold);
              const outTime = a.checkout_timestamp ? formatDateTime(a.checkout_timestamp).split(',')[1]?.trim() : null;
              const dur = sessionDuration(a);
              return (
                <div key={a.id} className="flex items-center gap-3 py-2.5">
                  <MemberAvatar member={member} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link to={`/members/${a.member_id}`} className="truncate text-sm font-semibold text-foreground hover:underline">
                      {a.member_name || member?.full_name || 'Unknown'}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {a.method === 'qr' ? 'QR' : 'Search'} · in {formatDateTime(a.timestamp).split(',')[1]?.trim()}{outTime ? ` · out ${outTime}${a.check_out_method === 'auto' ? ' (auto)' : ''}` : ''}
                    </p>
                  </div>
                  {open ? (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${overdue ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${overdue ? 'bg-amber-500' : 'animate-pulse bg-emerald-500'}`} /> {overdue ? 'auto out' : 'in gym'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <Timer className="h-3 w-3" /> {formatDuration(dur)}
                    </span>
                  )}
                  {mem && <StatusBadge status={deriveStatus(mem, settings?.expiry_warning_days ?? 7)} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {burst && (
          <CheckInOutBurst
            key={burst.mode + burst.time}
            mode={burst.mode}
            name={burst.name}
            time={burst.time}
            duration={burst.duration}
            onDone={() => setBurst(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PresentCard({ present, membership, settings, busy, onCancel, onCheckIn, onCheckOut }) {
  const { member, active, mode } = present;
  const status = membership ? deriveStatus(membership, settings?.expiry_warning_days ?? 7) : 'expired';
  const isOut = mode === 'out';
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <div className={`flex h-16 w-16 items-center justify-center rounded-full ${isOut ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>
        {isOut ? <LogOut className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
      </div>
      <div>
        <p className="font-heading text-xl font-bold text-foreground">{member.full_name}</p>
        <p className="text-sm text-muted-foreground">{member.member_id} · {member.mobile}</p>
      </div>
      {isOut ? (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Currently in gym
          </span>
          <p className="text-sm text-muted-foreground">Checked in at {formatDateTime(active.timestamp).split(',')[1]?.trim()} · {formatDuration(sessionDuration(active))} so far</p>
        </>
      ) : (
        <>
          <StatusBadge status={status} />
          {membership && (
            <p className="text-sm text-muted-foreground">Valid until {formatDate(membership.end_date)} · {daysRemaining(membership.end_date)} days left</p>
          )}
          {(status === 'expired' || status === 'frozen') && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              {status === 'frozen' ? 'Membership is frozen' : 'Membership has expired'} — check-in allowed but flagged.
            </p>
          )}
        </>
      )}
      <div className="mt-2 flex gap-2">
        <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        {isOut ? (
          <Button onClick={onCheckOut} disabled={busy} className="bg-amber-600 hover:bg-amber-700">
            <LogOut className="mr-1.5 h-4 w-4" /> {busy ? 'Checking out…' : 'Confirm check-out'}
          </Button>
        ) : (
          <Button onClick={onCheckIn} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle2 className="mr-1.5 h-4 w-4" /> {busy ? 'Checking in…' : 'Confirm check-in'}
          </Button>
        )}
      </div>
    </div>
  );
}