﻿import React, { useEffect, useRef, useState } from 'react';
import {
  QrCode, Phone, AlertTriangle, Loader2, RefreshCw,
  ShieldCheck, LogOut, LogIn, KeyRound, Eye, EyeOff,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  deriveStatus, formatDateTime, resolveActiveCheckin, checkoutMember,
  sessionDuration, formatDuration,
} from '@/lib/gym';
import StatusBadge from '@/components/gym/StatusBadge';
import CheckInOutBurst from '@/components/gym/CheckInOutBurst';
import { Image } from '@/components/ui/image';

// Stages:
//  idle      → entering mobile
//  searching → looking up mobile
//  pin       → member found, entering 4-digit PIN
//  confirm   → PIN verified, ready to check in
//  checkout  → member already in gym, ready to check out
//  submitting→ writing to DB
//  done      → success
//  error     → error shown

export default function CheckIn() {
  const [settings, setSettings]   = useState(null);
  const [mobile, setMobile]       = useState('');
  const [pin, setPin]             = useState('');
  const [showPin, setShowPin]     = useState(false);
  const [stage, setStage]         = useState('idle');
  const [member, setMember]       = useState(null);
  const [membership, setMembership] = useState(null);
  const [status, setStatus]       = useState('expired');
  const [active, setActive]       = useState(null);
  const [error, setError]         = useState('');
  const [burst, setBurst]         = useState(null);
  const pinRef = useRef(null);

  useEffect(() => {
    (async () => {
      const fallback = { gym_name: 'DOYEN THE GYM', attendance_duplicate_threshold: 240, expiry_warning_days: 7 };
      try {
        const list = await db.entities.Setting.list('-created_date', 1);
        setSettings(list?.[0] || fallback);
      } catch {
        setSettings(fallback);
      }
    })();
  }, []);

  const threshold  = settings?.attendance_duplicate_threshold ?? 240;
  const warningDays = settings?.expiry_warning_days ?? 7;
  const gymName    = settings?.gym_name || 'DOYEN THE GYM';

  const reset = () => {
    setMobile(''); setPin(''); setShowPin(false);
    setMember(null); setMembership(null); setActive(null);
    setStage('idle'); setError('');
  };

  // ── Step 1: look up by mobile ──────────────────────────────────────────────
  const lookupMobile = async (e) => {
    e?.preventDefault();
    const num = mobile.trim();
    if (num.replace(/\D/g, '').length < 6) {
      setError('Enter a valid mobile number.'); setStage('error'); return;
    }
    setStage('searching'); setError('');
    try {
      // Parallel fetch: member by mobile + (after finding member) memberships
      const matches = await db.entities.Member.filter({ mobile: num });
      if (!matches?.length) {
        setError('No member found with this mobile number. Please check with reception.');
        setStage('error'); return;
      }
      const m = matches[0];
      // Only fetch this member's memberships, sorted by end_date desc
      const ms = await db.entities.Membership.filter({ member_id: m.id }, '-end_date', 50);
      let latest = null;
      for (const x of ms) {
        if (!latest || new Date(x.end_date) > new Date(latest.end_date)) latest = x;
      }
      setMember(m);
      setMembership(latest);
      setStatus(deriveStatus(latest, warningDays));
      setStage('pin');
      // Focus the PIN field after state update
      setTimeout(() => pinRef.current?.focus(), 100);
    } catch (err) {
      setError(err?.message || 'Lookup failed. Please try again.');
      setStage('error');
    }
  };

  // ── Step 2: verify PIN ─────────────────────────────────────────────────────
  const verifyPin = async (e) => {
    e?.preventDefault();
    const entered = pin.trim();
    if (entered.length !== 4 || !/^\d{4}$/.test(entered)) {
      setError('Enter your 4-digit PIN.'); setStage('pin_error'); return;
    }

    // Member has no PIN set yet — can't verify, ask them to visit reception
    if (!member.checkin_pin) {
      setError('No PIN set for your account. Please ask reception to set your PIN from your member profile.');
      setStage('pin_error');
      return;
    }

    if (entered !== member.checkin_pin) {
      setError('Incorrect PIN. Please try again.');
      setStage('pin_error');
      setPin('');
      setTimeout(() => pinRef.current?.focus(), 80);
      return;
    }

    setStage('checking_session'); setError('');
    try {
      // resolveActiveCheckin is called once here and result passed to confirm/checkout stages
      const activeRec = await resolveActiveCheckin(member.id, threshold);
      setActive(activeRec);
      setStage(activeRec ? 'checkout' : 'confirm');
    } catch (err) {
      setError(err?.message || 'Session check failed.'); setStage('error');
    }
  };

  // ── Step 3a: check in ──────────────────────────────────────────────────────
  const confirmCheckIn = async () => {
    setStage('submitting');
    try {
      const now = new Date();
      await db.entities.Attendance.create({
        member_id:         member.id,
        member_name:       member.full_name,
        timestamp:         now.toISOString(),
        date:              now.toISOString().slice(0, 10),
        method:            'qr',
        correction_status: 'none',
        notes:             'Self check-in',
      });
      setBurst({ mode: 'in', name: member.full_name, time: formatDateTime(now.toISOString()).split(',')[1]?.trim() });
      setStage('done');
    } catch (err) {
      setError(err?.message || 'Check-in failed. Please try again.'); setStage('error');
    }
  };


  // ── Step 3b: check out ─────────────────────────────────────────────────────
  const confirmCheckOut = async () => {
    setStage('submitting');
    try {
      const now    = new Date();
      const closed = await checkoutMember(member.id, 'manual', threshold);
      if (!closed) {
        setError('Could not find an active session. You may already be checked out.');
        setStage('error');
        return;
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-background to-background px-4 py-8 dark:from-emerald-950/30">
      <div className="mx-auto max-w-md">

        {/* Header */}
        <div className="mb-6 text-center">
          {settings?.logo ? (
            <Image src={settings.logo} alt={`${gymName} logo`} fittingType="fill"
              className="mx-auto mb-3 h-14 w-14 rounded-full shadow-lg ring-1 ring-primary/30" />
          ) : (
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <QrCode className="h-7 w-7" />
            </div>
          )}
          <h1 className="font-heading text-2xl font-bold text-foreground">{gymName}</h1>
          <p className="text-sm text-muted-foreground">Member self check-in / check-out</p>
        </div>

        <div className="glass-card rounded-3xl p-6 shadow-xl">
          <AnimatePresence mode="wait">

            {/* ── Done ── */}
            {stage === 'done' && (
              <motion.div key="done" {...fade} className="flex flex-col items-center gap-4 py-6 text-center">
                <p className="font-heading text-lg font-bold text-foreground">All set!</p>
                <button onClick={reset}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
                  <RefreshCw className="h-4 w-4" /> Check in another member
                </button>
              </motion.div>
            )}

            {/* ── Checkout confirm ── */}
            {stage === 'checkout' && (
              <motion.div key="checkout" {...fade} className="flex flex-col items-center gap-4 py-2 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <LogOut className="h-12 w-12" />
                </div>
                <div>
                  <p className="font-heading text-xl font-bold text-foreground">{member?.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Checked in at {formatDateTime(active.timestamp).split(',')[1]?.trim()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(sessionDuration(active))} so far · auto checkout after {threshold} min
                  </p>
                </div>
                <div className="mt-2 flex w-full gap-2">
                  <Btn outline onClick={reset}>Cancel</Btn>
                  <Btn amber onClick={confirmCheckOut} disabled={stage === 'submitting'}>
                    {stage === 'submitting' ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Checking out…</> : 'Check out'}
                  </Btn>
                </div>
              </motion.div>
            )}

            {/* ── Check-in confirm ── */}
            {stage === 'confirm' && (
              <motion.div key="confirm" {...fade} className="flex flex-col items-center gap-4 py-2 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <LogIn className="h-12 w-12" />
                </div>
                <div>
                  <p className="font-heading text-xl font-bold text-foreground">{member?.full_name}</p>
                  <p className="text-sm text-muted-foreground">{member?.member_id}</p>
                </div>
                <StatusBadge status={status} />
                {membership && (
                  <p className="text-sm text-muted-foreground">
                    {status === 'expired' ? 'Membership expired'
                      : status === 'frozen' ? 'Membership frozen'
                      : `Valid until ${new Date(membership.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                  </p>
                )}
                {(status === 'expired' || status === 'frozen') && !blocked && (
                  <p className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    {status === 'frozen' ? 'Membership is frozen' : 'Membership has expired'} — please renew at reception.
                  </p>
                )}
                {blocked && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive">
                    This membership is cancelled. Please contact reception.
                  </p>
                )}
                <div className="mt-2 flex w-full gap-2">
                  <Btn outline onClick={reset}>Cancel</Btn>
                  <Btn green onClick={confirmCheckIn} disabled={blocked || stage === 'submitting'}>
                    {stage === 'submitting' ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Checking in…</> : 'Confirm check-in'}
                  </Btn>
                </div>
              </motion.div>
            )}

            {/* ── PIN entry ── */}
            {(stage === 'pin' || stage === 'pin_error' || stage === 'checking_session') && (
              <motion.div key="pin" {...fade}>
                <form onSubmit={verifyPin} className="space-y-4">
                  <div className="mb-2 flex items-center gap-3">
                    <button type="button" onClick={() => { setStage('idle'); setPin(''); setError(''); }}
                      className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
                    <span className="text-sm font-semibold text-foreground">{member?.full_name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{member?.mobile}</span>
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <KeyRound className="h-4 w-4 text-primary" />
                      Enter your 4-digit check-in PIN
                    </label>
                    {!member?.checkin_pin && (
                      <p className="mb-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                        No PIN set yet — please ask reception to set your PIN from your member profile.
                      </p>
                    )}
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        ref={pinRef}
                        type={showPin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={4}
                        value={pin}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                          setPin(v);
                          if (stage === 'pin_error') { setStage('pin'); setError(''); }
                        }}
                        placeholder="••••"
                        className="h-14 w-full rounded-xl border border-input bg-transparent pl-10 pr-12 text-center text-2xl font-bold tracking-[0.5em] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        autoComplete="off"
                      />
                      <button type="button" onClick={() => setShowPin((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {(stage === 'pin_error') && (
                    <p className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                    </p>
                  )}

                  <button type="submit"
                    disabled={pin.length !== 4 || stage === 'checking_session'}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50">
                    {stage === 'checking_session'
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</>
                      : 'Continue'}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ── Mobile entry (idle / error / searching) ── */}
            {(stage === 'idle' || stage === 'error' || stage === 'searching') && (
              <motion.div key="mobile" {...fade}>
                <form onSubmit={lookupMobile} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Registered mobile number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="tel"
                        inputMode="numeric"
                        autoFocus
                        value={mobile}
                        onChange={(e) => { setMobile(e.target.value); if (stage === 'error') setStage('idle'); }}
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

                  <button type="submit" disabled={stage === 'searching'}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60">
                    {stage === 'searching'
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking…</>
                      : 'Continue'}
                  </button>
                </form>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Step indicator */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <StepDot active={['idle','error','searching'].includes(stage)} done={!['idle','error','searching'].includes(stage)} label="Mobile" />
          <div className="h-px w-6 bg-border" />
          <StepDot active={['pin','pin_error','checking_session'].includes(stage)} done={['confirm','checkout','submitting','done'].includes(stage)} label="PIN" />
          <div className="h-px w-6 bg-border" />
          <StepDot active={['confirm','checkout','submitting'].includes(stage)} done={stage === 'done'} label="Check in" />
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
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

// ── Small helpers ──────────────────────────────────────────────────────────────

const fade = {
  initial:    { opacity: 0, y: 6 },
  animate:    { opacity: 1, y: 0 },
  exit:       { opacity: 0, y: -6 },
  transition: { duration: 0.18 },
};

function Btn({ children, outline, green, amber, disabled, onClick, type = 'button' }) {
  const base = 'flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm disabled:opacity-50 transition-colors';
  const style = outline
    ? 'border border-border bg-card text-foreground hover:bg-muted/60'
    : green
    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
    : amber
    ? 'bg-amber-600 text-white hover:bg-amber-700'
    : 'bg-primary text-primary-foreground hover:bg-primary/90';
  return <button type={type} className={`${base} ${style}`} disabled={disabled} onClick={onClick}>{children}</button>;
}

function StepDot({ active, done, label }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`h-2 w-2 rounded-full transition-colors ${done ? 'bg-primary' : active ? 'bg-primary/60 ring-2 ring-primary/30' : 'bg-border'}`} />
      <span className={`text-[10px] ${active || done ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{label}</span>
    </div>
  );
}
