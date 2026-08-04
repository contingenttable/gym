import React, { useEffect, useState } from 'react';
import { Loader2, Coffee } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * WakingUp — shows a friendly message after a short delay when a page
 * is still loading. This covers the Supabase free-tier cold-start scenario
 * where the first request after inactivity can take 10–25 seconds.
 *
 * Shows nothing for the first 4 seconds (fast loads don't need it).
 * Shows a subtle spinner + message after 4 s.
 * Shows a more explanatory message after 12 s.
 */
export default function WakingUp({ loading }) {
  const [phase, setPhase] = useState(0); // 0=hidden, 1=spinner, 2=explain

  useEffect(() => {
    if (!loading) { setPhase(0); return; }

    const t1 = setTimeout(() => setPhase(1), 4000);
    const t2 = setTimeout(() => setPhase(2), 12000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [loading]);

  if (!loading || phase === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="waking"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-full border border-border/60 bg-card/95 px-4 py-2 shadow-lg backdrop-blur text-sm text-muted-foreground"
      >
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        {phase >= 2 ? (
          <span>
            <span className="font-medium text-foreground">Waking up the database…</span>
            {' '}This takes ~15 s on the first load.
          </span>
        ) : (
          <span>Loading data…</span>
        )}
        {phase >= 2 && <Coffee className="h-4 w-4 text-amber-500" />}
      </motion.div>
    </AnimatePresence>
  );
}
