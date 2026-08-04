import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { LogIn, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

// Auto-dismisses after 2 seconds.
export default function CheckInOutBurst({ mode = 'in', name, time, duration, onDone }) {
  const isOut = mode === 'out';

  useEffect(() => {
    // Only fire confetti on check-in
    if (!isOut) {
      const colors = ['#22c55e', '#4ade80', '#a3e635', '#5eead4', '#bbf7d0', '#ffffff'];
      confetti({
        particleCount: 80,
        spread: 80,
        startVelocity: 40,
        origin: { y: 0.55 },
        colors,
        scalar: 0.9,
        ticks: 160,
        zIndex: 200,
      });
    }
    // Auto-dismiss after 2 seconds
    const t = setTimeout(() => onDone?.(), 2000);
    return () => clearTimeout(t);
  }, []);

  const ringClass = isOut ? 'bg-amber-500/25' : 'bg-emerald-500/25';
  const iconBg    = isOut ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500';
  const Icon      = isOut ? LogOut : LogIn;

  const content = (
    <motion.div
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 340, damping: 24 }}
      className="fixed inset-0 z-[150] flex items-center justify-center px-4"
      onClick={() => onDone?.()}
    >
      <div className="absolute inset-0 bg-background/50 backdrop-blur-sm" />
      <div className="relative glass-card rounded-3xl px-10 py-8 text-center shadow-2xl max-w-xs w-full">
        <div className={cn('absolute inset-0 rounded-3xl animate-ping opacity-20', ringClass)} />

        <div className={cn('mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full', iconBg)}>
          <Icon className="h-8 w-8" />
        </div>

        <p className="font-heading text-xl font-bold text-foreground">{name}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isOut ? 'Checked out' : 'Checked in'}{time ? ` at ${time}` : ''}
          {duration ? ` · ${duration}` : ''}
        </p>
      </div>
    </motion.div>
  );

  return createPortal(content, document.body);
}
