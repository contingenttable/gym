import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Snowflake, Ban } from 'lucide-react';
import { STATUS_META } from '@/lib/gym';
import { cn } from '@/lib/utils';

const TONE_CLASSES = {
  success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30',
  danger: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-rose-500/30',
  info: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 ring-sky-500/30',
  muted: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 ring-slate-500/30',
};

const ICONS = { CheckCircle2, AlertTriangle, XCircle, Snowflake, Ban };

export default function StatusBadge({ status, className }) {
  const meta = STATUS_META[status] || STATUS_META.active;
  const Icon = ICONS[meta.icon] || CheckCircle2;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        TONE_CLASSES[meta.tone],
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}