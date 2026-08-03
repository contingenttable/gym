import React from 'react';
import { Pencil, CalendarClock, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { formatCurrency } from '@/lib/gym';
import { cn } from '@/lib/utils';

function durationLabel(days) {
  if (!days || days <= 0) return 'Custom duration';
  if (days % 365 === 0) return days / 365 === 1 ? '1 Year' : `${days / 365} Years`;
  if (days % 30 === 0) return days / 30 === 1 ? '1 Month' : `${days / 30} Months`;
  return `${days} Days`;
}

function perDay(days, fee) {
  if (!days || days <= 0 || !fee) return null;
  return Math.round(fee / days);
}

export default function PlanCard({ plan, canManage, onEdit, onToggle }) {
  const pd = perDay(plan.duration_days, plan.standard_fee);
  const inactive = !plan.active;
  return (
    <div
      className={cn(
        'glass-card card-pop group relative overflow-hidden rounded-2xl',
        inactive && 'opacity-65 saturate-50'
      )}
    >
      {/* gradient accent strip */}
      <div className={cn('h-1.5 w-full', inactive ? 'bg-muted-foreground/40' : 'grad-brand')} />
      {/* soft glow halo for active plans */}
      {!inactive && (
        <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/20 blur-3xl" />
      )}
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-heading text-lg font-bold text-foreground">{plan.name}</p>
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              <CalendarClock className="h-3 w-3" /> {durationLabel(plan.duration_days)}
            </span>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
              inactive
                ? 'bg-muted text-muted-foreground ring-border'
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30'
            )}
          >
            {inactive ? 'Inactive' : 'Active'}
          </span>
        </div>

        <div className="mt-3 flex items-end gap-2">
          <p className={cn('font-heading text-3xl font-extrabold leading-none tnum', !inactive && 'gradient-text')}>
            {formatCurrency(plan.standard_fee)}
          </p>
          {pd != null && (
            <span className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Tag className="h-3 w-3" /> {formatCurrency(pd)}/day
            </span>
          )}
        </div>

        {plan.description && (
          <p className="mt-2.5 line-clamp-2 text-sm text-muted-foreground">{plan.description}</p>
        )}

        {canManage && (
          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
            <div className="flex items-center gap-2">
              <Switch checked={plan.active} onCheckedChange={onToggle} />
              <span className="text-xs text-muted-foreground">{plan.active ? 'Available' : 'Hidden'}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={onEdit} className="text-muted-foreground hover:text-foreground">
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}