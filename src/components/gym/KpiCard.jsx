import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONE = {
  primary: { grad: 'from-violet-500 to-fuchsia-500', glow: 'shadow-[0_8px_22px_-8px_rgba(168,85,247,0.55)]' },
  info: { grad: 'from-cyan-400 to-sky-500', glow: 'shadow-[0_8px_22px_-8px_rgba(14,165,233,0.5)]' },
  warning: { grad: 'from-amber-400 to-orange-500', glow: 'shadow-[0_8px_22px_-8px_rgba(245,158,11,0.5)]' },
  danger: { grad: 'from-rose-500 to-pink-600', glow: 'shadow-[0_8px_22px_-8px_rgba(244,63,94,0.5)]' },
  accent: { grad: 'from-fuchsia-500 to-purple-600', glow: 'shadow-[0_8px_22px_-8px_rgba(217,70,239,0.5)]' },
};

export default function KpiCard({ label, value, sub, icon: Icon, tone = 'primary', trend, className, to }) {
  const t = TONE[tone] || TONE.primary;
  const inner = (
    <>
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="tnum mt-1.5 font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl truncate">{value}</p>
          {sub && <p className="mt-0.5 text-xs font-medium text-muted-foreground">{sub}</p>}
        </div>
        {Icon && (
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white transition-transform duration-300 hover:scale-105', t.grad, t.glow)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {trend && trend.text && (
        <div className={cn(
          'mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
          trend.dir === 'down' ? 'bg-danger/10 text-danger ring-danger/25' : 'bg-success/10 text-success ring-success/25'
        )}>
          {trend.dir === 'down' ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
          {trend.text}
        </div>
      )}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={cn('clay card-pop relative block cursor-pointer overflow-hidden rounded-2xl p-4 sm:p-5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60', className)}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className={cn('clay card-pop relative overflow-hidden p-4 sm:p-5', className)}>
      {inner}
    </div>
  );
}