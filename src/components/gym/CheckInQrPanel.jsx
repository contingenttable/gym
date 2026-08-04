import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, Copy, RefreshCw, Smartphone, Users, Radio, Dumbbell } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { supabase } from '@/api/supabaseClient';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Image } from '@/components/ui/image';
import MemberAvatar from '@/components/gym/MemberAvatar';
import CheckInOutBurst from '@/components/gym/CheckInOutBurst';
import {
  formatDateTime, todayISO, isActiveCheckin, sessionDuration, formatDuration,
} from '@/lib/gym';

export default function CheckInQrPanel({ settings }) {
  const { toast }       = useToast();
  const [fullscreen, setFullscreen] = useState(false);
  const [tick, setTick]             = useState(0);
  const [inGym, setInGym]           = useState([]);
  const [burst, setBurst]           = useState(null);
  const membersMapRef = useRef({});

  const gymName    = settings?.gym_name || 'DOYEN THE GYM';
  const checkInUrl = `${window.location.origin}/check-in`;
  const qrSrc      = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=10&data=${encodeURIComponent(checkInUrl)}&_=${tick}`;

  const copyLink = () => {
    try {
      navigator.clipboard?.writeText(checkInUrl);
      toast({ title: 'Check-in link copied', duration: 2000 });
    } catch {}
  };

  const enterFullscreen = async () => {
    setFullscreen(true);
    try { await document.documentElement.requestFullscreen(); } catch {}
  };
  const exitFullscreen = async () => {
    setFullscreen(false);
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}
  };

  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement) setFullscreen(false); };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ── Initial load + Supabase realtime subscription ─────────────────────────
  useEffect(() => {
    let channelRef = null;
    let pollRef    = null;
    let mounted    = true;

    const refresh = async () => {
      if (!mounted) return;
      try {
        const att = await db.entities.Attendance.filter({ date: todayISO() }, '-timestamp', 500);
        if (!mounted) return;
        const map = membersMapRef.current;
        setInGym(
          att.filter((a) => isActiveCheckin(a))
             .map((a) => ({ att: a, member: map[a.member_id] }))
             .filter((x) => x.member)
        );
      } catch {}
    };

    const subscribe = () => {
      // Remove existing channel before creating a new one
      if (channelRef) {
        supabase.removeChannel(channelRef);
        channelRef = null;
      }

      channelRef = supabase
        .channel(`checkin-panel-${Date.now()}`)  // unique name prevents stale channels
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'attendance' },
          (payload) => {
            if (!mounted) return;
            const map = membersMapRef.current;
            const row = payload.new || payload.old;
            if (!row) return;

            if (payload.eventType === 'INSERT' && !row.checkout_timestamp) {
              const member = map[row.member_id];
              setInGym((prev) => [{ att: row, member }, ...prev.filter((x) => x.att.id !== row.id)]);
              if (member) {
                setBurst({ mode: 'in', name: member.full_name, time: formatDateTime(row.timestamp).split(',')[1]?.trim() });
              }
            } else if (payload.eventType === 'UPDATE' && row.checkout_timestamp) {
              setInGym((prev) => {
                const found = prev.find((x) => x.att.id === row.id);
                if (found?.member && row.check_out_method !== 'auto') {
                  const mins = sessionDuration({ ...found.att, checkout_timestamp: row.checkout_timestamp });
                  setBurst({ mode: 'out', name: found.member.full_name, time: formatDateTime(row.checkout_timestamp).split(',')[1]?.trim(), duration: formatDuration(mins) });
                }
                return prev.filter((x) => x.att.id !== row.id);
              });
            } else if (payload.eventType === 'DELETE') {
              setInGym((prev) => prev.filter((x) => x.att.id !== payload.old?.id));
            }
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // Reconnect after 3s on channel error
            setTimeout(() => { if (mounted) subscribe(); }, 3000);
          }
        });
    };

    // Initial data load
    (async () => {
      try {
        const [mems, att] = await Promise.all([
          db.entities.Member.list('-created_date', 1000),
          db.entities.Attendance.filter({ date: todayISO() }, '-timestamp', 500),
        ]);
        if (!mounted) return;
        const map = {};
        mems.forEach((m) => { map[m.id] = m; });
        membersMapRef.current = map;
        setInGym(
          att.filter((a) => isActiveCheckin(a))
             .map((a) => ({ att: a, member: map[a.member_id] }))
             .filter((x) => x.member)
        );
      } catch {}
    })();

    // Start realtime subscription
    subscribe();

    // Poll every 20s as safety net (handles missed realtime events)
    pollRef = setInterval(refresh, 20000);

    // Resubscribe when tab becomes visible (realtime may have disconnected)
    const onVisible = () => {
      if (document.visibilityState === 'visible' && mounted) {
        subscribe();
        refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      mounted = false;
      clearInterval(pollRef);
      document.removeEventListener('visibilitychange', onVisible);
      if (channelRef) supabase.removeChannel(channelRef);
    };
  }, []);

  // ── Sub-components ─────────────────────────────────────────────────────────

  const InGymList = ({ compact }) => (
    <div className={`flex flex-col ${compact ? '' : 'h-full min-h-0'}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="inline-flex items-center gap-2 font-heading text-base font-bold text-foreground">
          <Users className="h-4 w-4 text-emerald-500" /> In Gym Now
        </h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
          <Radio className="h-3 w-3 animate-pulse" /> {inGym.length} live
        </span>
      </div>
      {inGym.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No members checked in yet.</p>
      ) : (
        <div className={`space-y-1.5 ${compact ? 'max-h-72 overflow-y-auto scrollbar-thin pr-1' : 'flex-1 overflow-y-auto scrollbar-thin pr-1'}`}>
          {inGym.map(({ att, member }) => (
            <div key={att.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-3 py-2 backdrop-blur">
              <MemberAvatar member={member} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{member?.full_name || att.member_name}</p>
                <p className="text-xs text-muted-foreground">{member?.member_id || '—'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-muted-foreground">
                  in {formatDateTime(att.timestamp).split(',')[1]?.trim()}
                </p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  {formatDuration(sessionDuration(att))}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const QrBlock = ({ big }) => (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className={`overflow-hidden rounded-2xl border border-border/70 bg-white p-3 shadow-sm ${big ? '' : 'mx-auto'}`}>
        <img
          src={qrSrc}
          alt="Member self check-in QR code"
          className={big ? 'h-[min(78vh,78vw)] w-[min(78vh,78vw)]' : 'h-56 w-56'}
        />
      </div>
      <div>
        {settings?.logo && (
          <Image
            src={settings.logo}
            alt={`${gymName} logo`}
            fittingType="fill"
            className="mx-auto mb-2 h-10 w-10 rounded-full ring-1 ring-primary/30"
          />
        )}
        <p className="font-heading text-base font-bold text-foreground">{gymName}</p>
        <p className="text-xs text-muted-foreground">Scan to check in / check out</p>
      </div>
    </div>
  );

  return (
    <>
      <div className="mx-auto max-w-md space-y-4">
        <div className="glass-card rounded-2xl p-5">
          <QrBlock />
          <div className="mt-4 rounded-xl bg-accent/60 p-3 text-left">
            <p className="flex items-start gap-2 text-xs text-accent-foreground">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Display this at the entrance. Members scan it with their phone camera, enter their
                registered mobile number, and are checked in automatically.
              </span>
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={enterFullscreen}>
              <Maximize2 className="mr-1.5 h-4 w-4" /> Full screen
            </Button>
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="mr-1.5 h-4 w-4" /> Copy link
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setTick((t) => t + 1)}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh QR
            </Button>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5">
          <InGymList compact />
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          QR points to <span className="font-medium">{checkInUrl}</span>
        </p>
      </div>

      {/* Fullscreen kiosk mode */}
      {fullscreen && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col bg-background">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-8">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Dumbbell className="h-5 w-5" />
              </div>
              <div>
                <p className="font-heading text-sm font-bold leading-tight text-foreground">{gymName}</p>
                <p className="text-[11px] text-muted-foreground">Self Check-in Portal</p>
              </div>
            </div>
            <button
              onClick={exitFullscreen}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium shadow-sm hover:bg-muted/60"
            >
              <Minimize2 className="h-4 w-4" /> Close
            </button>
          </div>
          <div className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden px-4 pb-4 lg:flex-row lg:items-stretch lg:gap-6 lg:px-8 lg:pb-8">
            <div className="flex flex-1 items-center justify-center">
              <QrBlock big />
            </div>
            <div className="glass-card flex min-h-0 flex-1 flex-col rounded-2xl p-4 lg:flex-none lg:w-[26rem]">
              <InGymList />
            </div>
          </div>
        </div>,
        document.body
      )}

      <AnimatePresence>
        {burst && (
          <CheckInOutBurst
            key={`${burst.mode}-${burst.time}-${Math.random()}`}
            mode={burst.mode}
            name={burst.name}
            time={burst.time}
            duration={burst.duration}
            onDone={() => setBurst(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
