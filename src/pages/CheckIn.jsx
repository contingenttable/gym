import React, { useEffect, useState } from 'react';

import {
  QrCode, Phone, AlertTriangle, Loader2, RefreshCw, ShieldCheck, LogOut, LogIn,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import {
  deriveStatus, formatDateTime, resolveActiveCheckin, checkoutMember,
  sessionDuration, formatDuration,
} from '@/lib/gym';
import StatusBadge from '@/components/gym/StatusBadge';
import CheckInOutBurst from '@/components/gym/CheckInOutBurst';
import { Image } from '@/components/ui/image';

export default function CheckIn() {
  const [settings, setSettings] = useState(null);
  const [mobile, setMobile] = useState('');
  const [stage, setStage] = useState('idle'); // idle | searching | confirm | checkout | submitting | done | error
  const [member, setMember] = useState(null);
  const [membership, setMembership] = useState(null);
  const [status, setStatus] = useState('expired');
  const [active, setActive] = useState(null);
  const [error, setError] = useState('');
  const [burst, setBurst] = useState(null);

  useEffect(() => {
    (async () => {
      const fallback = { gym_name: 'DOYEN THE GYM', attendance_duplicate_threshold: 240, expiry_warning_days: 7 };
      try {
        const list = await db.entities.Setting.list('-created_date', 1);
        setSettings(list?.[0] || fallback);
      } catch (e) {
        setSettings(fallback);
      }
    })();
  }, []);

  const threshold = settings?.attendance_duplicate_threshold ?? 240;
  const warningDays = settings?.expiry_warning_days ?? 7;
  const gymName = settings?.gym_name || 'DOYEN THE GYM';

  const reset = () => {
    setMobile(''); setMember(null); setMembership(null); setActive(null);
    setStage('idle'); setError('');
  };

  const lookup = async (e) => {
    e?.preventDefault();
    const num = mobile.trim();
    if (num.replace(/\D/g, '').length < 6) {
      setError('Enter a valid mobile number.'); setStage('error'); return;
    }
    setStage('searching'); setError('');
    try {
      const matches = await db.entities.Member.filter({ mobile: num });
      if (!matches || !matches.length) {
        setError('No member found with this mobile number. Please check with reception.');
        setStage('error'); return;
      }
      const m = matches[0];
      const ms = await db.entities.Membership.filter({ member_id: m.id });
      let latest = null;
      for (const x of ms) if (!latest || new Date(x.end_date) > new Date(latest.end_date)) latest = x;
      const st = deriveStatus(latest, warningDays);
      setMember(m); setMembership(latest); setStatus(st);

      // Resolve the true open session (scans recent records, auto-checks-out if overdue).
      const activeRec = await resolveActiveCheckin(m.id, threshold);

      setActive(activeRec);
      setStage(activeRec ? 'checkout' : 'confirm');
    } catch (err) {
      setError(err?.message || 'Lookup failed. Please try again.'); setStage('error');
    }
  };

  const confirmCheckIn = async () => {
    setStage('submitting');
    try {
      const now = new Date();
      await db.entities.Attendance.create({
        member_id: member.id,
        member_name: member.full_name,
        timestamp: now.toISOString(),
        date: now.toISOString().slice(0, 10),
        method: 'qr',
        correction_status: 'none',
        notes: 'Self check-in',
      });
      setBurst({ mode: 'in', name: member.full_name, time: formatDateTime(now.toISOString()).split(',')[1]?.trim() });
      setStage('done');
    } catch (err) {
      setError(err?.message || 'Check-in failed. Please try again.'); setStage('error');
    }
  };

  const confirmCheckOut = async () => {
    setStage('submitting');
    try {
      const now = new Date();
      const closed = await checkoutMember(member.id, 'manual', threshold);
      if (!closed) {
        setError('No active session found.'); setStage('error'); return;
      }
      const mins = sessionDuration(closed);
      setBurst({
        mode: 'out', name: member.full_name,
        time: formatDateTime(now.toISOString()).split(',')[1]?.trim(),
        duration: formatDuration(mins),
      });
      setStage('done');
    } catch (err) {
      setError(err?.message || 'Check-out failed. Please try again.'); setStage('error');
    }
  };

  const blocked = status === 'cancelled';

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-background to-background px-4 py-8 dark:from-emerald-950/30">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-6 text-center">
          {settings?.logo ? (
            <Image src={settings.logo} alt="DOYEN THE GYM logo" fittingType="fill" className="mx-auto mb-3 h-14 w-14 rounded-full shadow-lg ring-1 ring-primary/30" />
          ) : (
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <QrCode className="h-7 w-7" />
            </div>
          )}
          <h1 className="font-heading text-2xl font-bold text-foreground">{gymName}</h1>
          <p className="text-sm text-muted-foreground">Member self check-in / check-out</p>
        </div>

        <div className="glass-card rounded-3xl p-6 shadow-xl">
          {stage === 'done' ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <p className="font-heading text-lg font-bold text-foreground">All set!</p>
              <button onClick={reset} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
                <RefreshCw className="h-4 w-4" /> Check in another member
              </button>
            </div>
          ) : stage === 'checkout' ? (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <LogOut className="h-12 w-12" />
              </div>
              <div>
                <p className="font-heading text-xl font-bold text-foreground">{member?.full_name}</p>
                <p className="text-sm text-muted-foreground">Checked in at {formatDateTime(active.timestamp).split(',')[1]?.trim()}</p>
                <p className="text-xs text-muted-foreground">{formatDuration(sessionDuration(active))} so far · auto check-out after {threshold} min</p>
              </div>
              <div className="mt-2 flex w-full gap-2">
                <button onClick={reset} className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:bg-muted/60">Cancel</button>
                <button onClick={confirmCheckOut} disabled={stage === 'submitting'} className="flex-1 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60">
                  {stage === 'submitting' ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Checking out…</> : 'Check out'}
                </button>
              </div>
            </div>
          ) : stage === 'confirm' ? (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <LogIn className="h-12 w-12" />
              </div>
              <div>
                <p className="font-heading text-xl font-bold text-foreground">{member?.full_name}</p>
                <p className="text-sm text-muted-foreground">{member?.member_id} · {member?.mobile}</p>
              </div>
              <StatusBadge status={status} />
              {membership && (
                <p className="text-sm text-muted-foreground">
                  {status === 'expired' ? 'Membership expired' : status === 'frozen' ? 'Membership frozen' : `Valid until ${new Date(membership.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                </p>
              )}
              {(status === 'expired' || status === 'frozen') && !blocked && (
                <p className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  {status === 'frozen' ? 'Membership is frozen' : 'Membership has expired'} — please renew at reception.
                </p>
              )}
              {blocked && (
                <p className="rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive">This membership is cancelled. Please contact reception.</p>
              )}
              <div className="mt-2 flex w-full gap-2">
                <button onClick={reset} className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:bg-muted/60">Cancel</button>
                <button onClick={confirmCheckIn} disabled={blocked || stage === 'submitting'} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">
                  {stage === 'submitting' ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Checking in…</> : 'Confirm check-in'}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={lookup} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Registered mobile number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoFocus
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="Enter your mobile number"
                    className="h-12 w-full rounded-xl border border-input bg-transparent pl-9 pr-3 text-base shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>
              {stage === 'error' && (
                <p className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </p>
              )}
              <button
                type="submit"
                disabled={stage === 'searching'}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
              >
                {stage === 'searching' ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking…</> : <>Continue</>}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Secure check-in · {gymName}
        </p>
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