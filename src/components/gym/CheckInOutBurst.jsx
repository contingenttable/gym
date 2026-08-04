import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { LogIn, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

// Celebratory overlay shown after a check-in or check-out.
export default function CheckInOutBurst({ mode = 'in', name, time, duration, onDone }) {
  const isOut = mode === 'out';

  useEffect(() => {
    const colors = isOut
      ? ['#f59e0b', '#fb923c', '#fbbf24', '#fda4af', '#fde68a', '#ffffff']
      : ['#22c55e', '#4ade80', '#a3e635', '#5eead4', '#bbf7d0', '#ffffff'];

    const fire = () => {
      confetti({ particleCount: 120, spread: 90, startVelocity: 45, origin: { y: 0.6 }, colors, scalar: 1, ticks: 240, zIndex: 200 });
      setTimeout(() => confetti({ particleCount: 70, angle: 60, spread: 75, startVelocity: 42, origin: { x: 0, y: 0.65 }, colors, scalar: 0.85, zIndex: 200 }), 120);
      setTimeout(() => confetti({ particleCount: 70, angle: 120, spread: 75, startVelocity: 42, origin: { x: 1, y: 0.65 }, colors, scalar: 0.85, zIndex: 200 }), 120);
      setTimeout(() => confetti({ particleCount: 40, spread: 120, startVelocity: 28, origin: { y: 0.5 }, colors, scalar: 0.6, ticks: 180, zIndex: 200 }), 380);
    };
    fire();
    const t = setTimeout(() => onDone?.(), 3200);
    return () => clearTimeout(t);
  }, []);

  const ringClass = isOut ? 'bg-amber-500/25' : 'bg-emerald-500/25';
  const iconBg    = isOut ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500';
  const Icon      = isOut ? LogOut : LogIn;

  const content = (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="fixed inset-0 z-[150] flex items-center justify-center px-4"
      onClick={() => onDone?.()}
    >
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <div className="relative glass-card rounded-3xl p-10 text-center shadow-2xl max-w-xs w-full">
        {/* Rings */}
        <div className={cn('absolute inset-0 rounded-3xl animate-ping opacity-30', ringClass)} />
        <div className={cn('absolute inset-0 rounded-3xl opacity-10', ringClass)} />

        <div className={cn('mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full', iconBg)}>
          <Icon className="h-10 w-10" />
        </div>

        <p className="font-heading text-2xl font-bold text-foreground">{name}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isOut ? 'Checked out' : 'Checked in'} at {time}
          {duration && ` · ${duration}`}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">Tap anywhere to dismiss</p>
      </div>
    </motion.div>
  );

  return createPortal(content, document.body);
}
