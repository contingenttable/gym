import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { LogIn, LogOut, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// Premium celebratory overlay shown after a check-in or check-out.
export default function CheckInOutBurst({ mode = 'in', name, time, duration, onDone, portal }) {
  const isOut = mode === 'out';

  useEffect(() => {
    const colors = isOut
      ? [' #f59e0b', ' #fb923c', ' #fbbf24', ' #fda4af', ' #fde68a', ' #ffffff']
      : [' #22c55e', ' #4ade80', ' #a3e635', ' #5eead4', ' #bbf7d0', ' #ffffff'];

    const fire = () => {
      // central burst
      confetti({ particleCount: 120, spread: 90, startVelocity: 45, origin: { y: 0.6 }, colors, scalar: 1, ticks: 240, zIndex: 200 });
      // dual side cannons
      setTimeout(() => confetti({ particleCount: 70, angle: 60, spread: 75, startVelocity: 42, origin: { x: 0, y: 0.65 }, colors, scalar: 0.85, zIndex: 200 }), 120);
      setTimeout(() => confetti({ particleCount: 70, angle: 120, spread: 75, startVelocity: 42, origin: { x: 1, y: 0.65 }, colors, scalar: 0.85, zIndex: 200 }), 120);
      // delayed sparkle pop
      setTimeout(() => confetti({ particleCount: 40, spread: 120, startVelocity: 28, origin: { y: 0.5 }, colors, scalar: 0.6, ticks: 180, zIndex: 200 }), 380);
    };
    fire();
    const t = setTimeout(() => onDone?.(), 3200);
    return () => clearTimeout(t);
  }, []);

  const ringClass = isOut ? 'bg-amber-500/25' : 'bg-emerald-500/25';