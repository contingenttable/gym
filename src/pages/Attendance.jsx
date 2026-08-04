import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Search, ScanLine, CalendarCheck, Users, Clock, TrendingUp, CheckCircle2, QrCode,
  LogOut, Timer,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
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
  const [members, setMembers]       = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [query, setQuery]           = useState('');
  const [present, setPresent]       = useState(null);
  const [busy, setBusy]             = useState(false);
  const [burst, setBurst]           = useState(null);

  const threshold = settings?.attendance_duplicate_threshold ?? 240;

  // ── Initial load ───────────────────────────────────────────────────────────
  const loadAll = async (silent = false) => {
    try {
      const [m, ms, att] = await Promise.all([
        db.entities.Member.list('-created_date', 1000),
        db.entities.Membership.list('-created_date', 1000),
        db.entities.Attendance.list('-created_date', 500),
      ]);
      setMembers(m);
      setMemberships(ms);
      setAttendance(att);

      const stale = att.filter((a) => checkOutDue(a, threshold));
      if (stale.length) {
        // Run all auto-checkouts in parallel, not sequentially
        await Promise.all(stale.map((a) =>
          db.entities.Attendance.update(a.id, {
            checkout_timestamp: autoCheckoutTime(a, threshold),
            check_out_method: 'auto',
          }).catch(() => {})
        ));
        const fresh = await db.entities.Attendance.list('-created_date', 500);
        setAttendance(fresh);
      }
    } catch (e) {
      console.error('Attendance loadAll failed:', e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // ── Derived lists ──────────────────────────────────────────────────────────
  const todayList = useMemo(
    () => attendance
      .filter((a) => a.date === todayISO())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
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

  // O(1) member lookup by id — replaces O(n) members.find() in render loop
  const memberMap = useMemo(() => {
    const map = {};
    for (const m of members) map[m.id] = m;
    return map;
  }, [members]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return members.filter((m) =>
      (m.full_name || '').toLowerCase().includes(q) ||
      (m.member_id || '').toLowerCase().includes(q) ||
      (m.mobile || '').includes(q)
    ).slice(0, 8);
  }, [members, query]);

  // ── Member lookup ──────────────────────────────────────────────────────────
  const presentMember = async (member) => {
    const active = await resolveActiveCheckin(member.id, threshold);
    setPresent({ member, active, mode: active ? 'out' : 'in' });
  };

  const handleScan = async (token) => {
    let member = members.find((m) => m.qr_token === token);
    if (!member) {
      try {
        const fresh = await db.entities.Member.filter({ qr_token: token });
        member = fresh?.[0] || null;
        if (member) setMembers((prev) => prev.some((m) => m.id === member.id) ? prev : [member, ...prev]);
      } catch {}
    }
    if (!member) {
      toast({ title: 'Member not found', description: 'This QR is not linked to a member.', variant: 'destructive' });
      return;
    }
    presentMember(member);
  };

  // ── Check-in (optimistic) ──────────────────────────────────────────────────
  const doCheckIn = async (member, method) => {
    setBusy(true);
    try {
      const active = await resolveActiveCheckin(member.id, threshold);
      if (active) {
        toast({ title: 'Already checked in', description: `${member.full_name} already has an active session.` });
        setPresent({ member, active, mode: 'out' });
        return;
      }

      const now = new Date();
      const optimisticRecord = {
        id: `optimistic-${Date.now()}`,
        member_id: member.id,
        member_name: member.full_name,
        timestamp: now.toISOString(),
        date: now.toISOString().slice(0, 10),
        method,
        correction_status: 'none',
        checkout_timestamp: null,
      };

      // ① Instant UI update
      setAttendance((prev) => [optimisticRecord, ...prev]);
      setPresent(null);
      setQuery('');
      setBurst({ mode: 'in', name: member.full_name, time: formatDateTime(now.toISOString()).split(',')[1]?.trim() });

      // ② Write to DB in background
      const rec = await db.entities.Attendance.create({
        member_id: member.id,
        member_name: member.full_name,
        timestamp: now.toISOString(),
        date: now.toISOString().slice(0, 10),
        method,
        correction_status: 'none',
      });

      // ③ Replace optimistic record with real one
      setAttendance((prev) => prev.map((a) => a.id === optimisticRecord.id ? rec : a));

      await logAudit({ action: 'attendance.create', entity: 'Attendance', entity_id: rec.id, reason: `Check-in via ${method}` });
    } catch (e) {
      // Roll back optimistic update on error
      setAttendance((prev) => prev.filter((a) => !a.id?.startsWith('optimistic-')));
      toast({ title: 'Check-in failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  // ── Check-out (optimistic) ─────────────────────────────────────────────────
  const doCheckOut = async (member) => {
    setBusy(true);
    const now = new Date();

    // ① Find the open record in local state first
    const openRecord = attendance.find(
      (a) => a.member_id === member.id && isActiveCheckin(a)
    );

    // ② Optimistic update — mark it checked out immediately in UI
    if (openRecord) {
      setAttendance((prev) => prev.map((a) =>
        a.id === openRecord.id
          ? { ...a, checkout_timestamp: now.toISOString(), check_out_method: 'manual' }
          : a
      ));
    }
    setPresent(null);

    try {
      // ③ Write to DB
      const closed = await checkoutMember(member.id, 'manual', threshold);

      if (!closed) {
        // Roll back optimistic update
        if (openRecord) {
          setAttendance((prev) => prev.map((a) =>
            a.id === openRecord.id
              ? { ...a, checkout_timestamp: null, check_out_method: null }
              : a
          ));
        }
        toast({ title: 'No active session', description: `${member.full_name} is not currently checked in.` });
        return;
      }

      // ④ Replace optimistic record with real DB record
      setAttendance((prev) => prev.map((a) =>
        a.id === (openRecord?.id || closed.id) ? closed : a
      ));

      const mins = sessionDuration(closed);
      setBurst({
        mode: 'out',
        name: member.full_name,
        time: formatDateTime(now.toISOString()).split(',')[1]?.trim(),
        duration: formatDuration(mins),
      });

      await logAudit({ action: 'attendance.update', entity: 'Attendance', entity_id: closed.id, reason: 'Manual check-out' });
    } catch (e) {
      // Roll back optimistic update on error
      if (openRecord) {
        setAttendance((prev) => prev.map((a) =>
          a.id === openRecord.id
            ? { ...a, checkout_timestamp: null, check_out_method: null }
            : a
        ));
      }
      toast({ title: 'Check-out failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const uniqueToday = new Set(todayList.map((a) => a.member_id)).size;
  const inGymNow    = todayList.filter((a) => isActiveCheckin(a) && !checkOutDue(a, threshold)).length;
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CalendarCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground">Fast check-in & check-out for reception</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Today's Check-ins" value={uniqueToday} icon={CalendarCheck} tone="primary" />
        <KpiCard label="In Gym Now"        value={inGymNow}    icon={Users}         tone="info" />
        <KpiCard label="Peak Time"         value={peakHour}    icon={TrendingUp}    tone="accent" />
        <KpiCard label="Latest"            value={todayList[0] ? formatDateTime(todayList[0].timestamp).split(',')[1]?.trim() : '—'} icon={Clock} tone="warning" />
      </div>

      {/* Check-in tabs */}
      <Tabs defaultValue="search" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="search"><Search    className="mr-1.5 h-4 w-4" /> Search</TabsTrigger>
          <TabsTrigger value="scan">  <ScanLine  className="mr-1.5 h-4 w-4" /> QR Scan</TabsTrigger>
          <TabsTrigger value="self">  <QrCode    className="mr-1.5 h-4 w-4" /> Self Check-in</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="mt-4">
          <div className="glass-card rounded-2xl p-5">
            <AnimatePresence mode="wait">
              {present ? (
                <motion.div key="present" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
                  <PresentCard present={present} membership={latestByMember[present.member.id]} settings={settings} busy={busy}
                    onCancel={() => setPresent(null)}
                    onCheckIn={() => doCheckIn(present.member, 'search')}
                    onCheckOut={() => doCheckOut(present.member)} />
                </motion.div>
              ) : (
                <motion.div key="search" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                      placeholder="Type name, member ID or mobile…" className="pl-9 h-12 text-base" />
                  </div>
                  {query.trim().length >= 2 ? (
                    <div className="mt-3">
                      {searchResults.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          No matches. <Link to="/members/new" className="text-primary hover:underline">Register new member</Link>
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {searchResults.map((m) => {
                            const mem = latestByMember[m.id];
                            const st  = mem ? deriveStatus(mem, settings?.expiry_warning_days ?? 7) : 'expired';
                            return (
                              <li key={m.id}>
                                <button onClick={() => presentMember(m)}
                                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-muted/60">
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
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">Start typing to find a member for check-in.</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </TabsContent>

        <TabsContent value="scan" className="mt-4">
          <div className="glass-card rounded-2xl p-5">
            <AnimatePresence mode="wait">
              {present ? (
                <motion.div key="present" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
                  <PresentCard present={present} membership={latestByMember[present.member.id]} settings={settings} busy={busy}
                    onCancel={() => setPresent(null)}
                    onCheckIn={() => doCheckIn(present.member, 'qr')}
                    onCheckOut={() => doCheckOut(present.member)} />
                </motion.div>
              ) : (
                <motion.div key="scanner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  <div className="mx-auto max-w-md space-y-3">
                    <p className="text-center text-sm text-muted-foreground">Point the camera at the member's QR card.</p>
                    <QrScanner onDetect={handleScan} />
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <QrCode className="h-4 w-4" /> The QR contains an opaque token — no personal data is exposed.
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </TabsContent>

        <TabsContent value="self" className="mt-4">
          <CheckInQrPanel settings={settings} />
        </TabsContent>
      </Tabs>

      {/* Today's sessions — animated list */}
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
            <AnimatePresence initial={false}>
              {todayList.map((a) => {
                const member   = memberMap[a.member_id];
                const mem      = member ? latestByMember[member.id] : null;
                const open     = isActiveCheckin(a);
                const overdue  = open && checkOutDue(a, threshold);
                const outTime  = a.checkout_timestamp ? formatDateTime(a.checkout_timestamp).split(',')[1]?.trim() : null;
                const dur      = sessionDuration(a);
                const isOptimistic = a.id?.startsWith('optimistic-');

                return (
                  <motion.div
                    key={a.id}
                    layout
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: isOptimistic ? 0.7 : 1, x: 0 }}
                    exit={{ opacity: 0, x: -24, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="flex items-center gap-3 py-2.5 overflow-hidden"
                  >
                    <MemberAvatar member={member} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link to={`/members/${a.member_id}`} className="truncate text-sm font-semibold text-foreground hover:underline">
                        {a.member_name || member?.full_name || 'Unknown'}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {a.method === 'qr' ? 'QR' : 'Search'} · in {formatDateTime(a.timestamp).split(',')[1]?.trim()}
                        {outTime ? ` · out ${outTime}${a.check_out_method === 'auto' ? ' (auto)' : ''}` : ''}
                      </p>
                    </div>

                    {/* Status badge — animates when it changes */}
                    <AnimatePresence mode="wait">
                      {open ? (
                        <motion.span
                          key="in"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            overdue
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${overdue ? 'bg-amber-500' : 'animate-pulse bg-emerald-500'}`} />
                          {overdue ? 'auto out' : 'in gym'}
                        </motion.span>
                      ) : (
                        <motion.span
                          key="out"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                        >
                          <Timer className="h-3 w-3" /> {formatDuration(dur)}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {mem && <StatusBadge status={deriveStatus(mem, settings?.expiry_warning_days ?? 7)} />}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Check-in / out burst overlay */}
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

// ── PresentCard ────────────────────────────────────────────────────────────────
function PresentCard({ present, membership, settings, busy, onCancel, onCheckIn, onCheckOut }) {
  const { member, active, mode } = present;
  const status = membership ? deriveStatus(membership, settings?.expiry_warning_days ?? 7) : 'expired';
  const isOut  = mode === 'out';

  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={`flex h-16 w-16 items-center justify-center rounded-full ${
          isOut ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
        }`}
      >
        {isOut ? <LogOut className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
      </motion.div>
      <div>
        <p className="font-heading text-xl font-bold text-foreground">{member.full_name}</p>
        <p className="text-sm text-muted-foreground">{member.member_id} · {member.mobile}</p>
      </div>
      {isOut ? (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Currently in gym
          </span>
          {active && (
            <p className="text-sm text-muted-foreground">
              Checked in at {formatDateTime(active.timestamp).split(',')[1]?.trim()} · {formatDuration(sessionDuration(active))} so far
            </p>
          )}
        </>
      ) : (
        <>
          <StatusBadge status={status} />
          {membership && (
            <p className="text-sm text-muted-foreground">
              Valid until {formatDate(membership.end_date)} · {daysRemaining(membership.end_date)} days left
            </p>
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
