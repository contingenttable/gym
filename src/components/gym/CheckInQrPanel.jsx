import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, Copy, RefreshCw, Smartphone, Users, Radio, Dumbbell } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Image } from '@/components/ui/image';
import MemberAvatar from '@/components/gym/MemberAvatar';
import CheckInOutBurst from '@/components/gym/CheckInOutBurst';
import {
  formatDateTime, todayISO, isActiveCheckin, sessionDuration, formatDuration,
} from '@/lib/gym';

export default function CheckInQrPanel({ settings }) {
  const { toast } = useToast();
  const [fullscreen, setFullscreen] = useState(false);
  const [tick, setTick] = useState(0);
  const [inGym, setInGym] = useState([]); // [{ att, member }]
  const [burst, setBurst] = useState(null);
  const membersMapRef = useRef({});

  const gymName = settings?.gym_name || 'DOYEN THE GYM';
  const checkInUrl = `${window.location.origin}/check-in`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=10&data=${encodeURIComponent(checkInUrl)}&_=${tick}`;

  const copyLink = () => {
    try { navigator.clipboard?.writeText(checkInUrl); toast({ title: 'Check-in link copied' }); } catch (e) {}
  };

  const enterFullscreen = async () => {
    setFullscreen(true);
    try { await document.documentElement.requestFullscreen(); } catch (e) {}
  };
  const exitFullscreen = async () => {
    setFullscreen(false);
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (e) {}
  };

  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement) setFullscreen(false); };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Load today's open check-ins + subscribe to live check-in / check-out events.
  useEffect(() => {
    let unsub;
    const refresh = async () => {
      try {
        const att = await db.entities.Attendance.filter({ date: todayISO() }, '-timestamp', 500);
        const map = membersMapRef.current;
        setInGym(att.filter((a) => isActiveCheckin(a)).map((a) => ({ att: a, member: map[a.member_id] })).filter((x) => x.member));
      } catch (e) {}
    };
    (async () => {
      try {
        const [mems, att] = await Promise.all([
          db.entities.Member.list('-created_date', 1000),
          db.entities.Attendance.filter({ date: todayISO() }, '-timestamp', 500),
        ]);
        const map = {};
        mems.forEach((m) => { map[m.id] = m; });
        membersMapRef.current = map;
        setInGym(att.filter((a) => isActiveCheckin(a)).map((a) => ({ att: a, member: map[a.member_id] })).filter((x) => x.member));
      } catch (e) {}
    })();

    // Safety net: re-fetch every 20s so a missed realtime event (checkout on
    // another device) still removes the member from the "In Gym Now" list.
    const poll = setInterval(refresh, 20000);

    unsub = db.entities.Attendance.subscribe((event) => {
      const e = event || {};
      const map = membersMapRef.current;
      if (e.type === 'create' && e.data && !e.data.checkout_timestamp) {
        const member = map[e.data.member_id];
        setInGym((prev) => [{ att: e.data, member }, ...prev.filter((x) => x.att.id !== e.data.id)]);
        if (member) setBurst({ mode: 'in', name: member.full_name, time: formatDateTime(e.data.timestamp).split(',')[1]?.trim() });
      } else if (e.type === 'update' && e.data && e.data.checkout_timestamp) {
        setInGym((prev) => {
          const found = prev.find((x) => x.att.id === e.data.id);
          if (found?.member && e.data.check_out_method !== 'auto') {
            const mins = sessionDuration({ ...found.att, checkout_timestamp: e.data.checkout_timestamp });
            setBurst({ mode: 'out', name: found.member.full_name, time: formatDateTime(e.data.checkout_timestamp).split(',')[1]?.trim(), duration: formatDuration(mins) });
          }
          return prev.filter((x) => x.att.id !== e.data.id);
        });
      } else if (e.type === 'delete') {
        setInGym((prev) => prev.filter((x) => x.att.id !== e.data?.id));
      }
    });
    return () => { unsub && unsub(); clearInterval(poll); };
  }, []);

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
                <p className="text-xs font-medium text-muted-foreground">in {formatDateTime(att.timestamp).split(',')[1]?.trim()}</p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{formatDuration(sessionDuration(att))}</p>
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
        <img src={qrSrc} alt="Member self check-in QR code" className={big ? 'h-[min(78vh,78vw)] w-[min(78vh,78vw)]' : 'h-56 w-56'} />
      </div>
      <div>
        {settings?.logo && (
          <Image src={settings.logo} alt="DOYEN THE GYM logo" fittingType="fill" className="mx-auto mb-2 h-10 w-10 rounded-full ring-1 ring-primary/30" />
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
              <span>Display this at the entrance. Members scan it with their phone camera, enter their registered mobile number, and are checked in automatically. Live check-ins appear below.</span>
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
              <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5">
          <InGymList compact />
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          The QR points to <span className="font-medium">{checkInUrl}</span>
        </p>
      </div>

      {/* Fullscreen: ONLY the QR + live member list. No sidebar, no menu. */}
      {fullscreen && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col bg-background">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-8">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl grad-brand text-primary-foreground shadow-sm">
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
            key={burst.mode + burst.time + Math.random()}
            mode={burst.mode}
            name={burst.name}
            time={burst.time}
            duration={burst.duration}
            portal
            onDone={() => setBurst(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}