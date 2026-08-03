import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { Repeat, TrendingDown, Activity, Percent } from 'lucide-react';
import EmptyState from '@/components/gym/EmptyState';

const MONTHS_BACK = 9;

const tooltipStyle = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 12,
  fontSize: 12,
};

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(d) {
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

/**
 * Cohort retention: members are grouped by the month their FIRST membership
 * started. Each cohort bar stacks Renewed (≥2 memberships) vs Dropped off
 * (only membership ended, no renewal) vs Still active (first plan not ended).
 */
export default function RetentionChart({ memberships }) {
  const { cohorts, totals } = useMemo(() => {
    const byMember = {};
    for (const m of memberships || []) {
      if (!m?.member_id || !m.start_date) continue;
      (byMember[m.member_id] ||= []).push(m);
    }

    const now = new Date();
    const buckets = {};
    let totalRenewed = 0, totalDropped = 0, totalActive = 0;

    for (const list of Object.values(byMember)) {
      list.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
      const first = list[0];
      const cohortDate = new Date(first.start_date);
      if (isNaN(cohortDate.getTime())) continue;
      const key = monthKey(cohortDate);
      const renewed = list.length > 1;
      const firstEnded = first.end_date ? new Date(first.end_date) < now : false;
      const droppedOff = !renewed && firstEnded;
      const active = !renewed && !firstEnded;

      const b = buckets[key] ||= { label: monthLabel(cohortDate), renewed: 0, droppedOff: 0, active: 0, total: 0 };
      if (renewed) b.renewed += 1;
      else if (droppedOff) b.droppedOff += 1;
      else b.active += 1;
      b.total += 1;

      if (renewed) totalRenewed += 1;
      else if (droppedOff) totalDropped += 1;
      else totalActive += 1;
    }

    const sorted = Object.entries(buckets)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => v)
      .slice(-MONTHS_BACK);

    const decided = totalRenewed + totalDropped;
    const retentionRate = decided ? Math.round((totalRenewed / decided) * 100) : null;

    return {
      cohorts: sorted,
      totals: { totalRenewed, totalDropped, totalActive, retentionRate, decided },
    };
  }, [memberships]);

  if (!cohorts.length) {
    return (
      <EmptyState
        icon={Activity}
        title="No retention data yet"
        description="Once members start and renew or let memberships lapse, retention cohorts appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-heading text-base font-bold text-foreground">Member Retention</h3>
        <p className="text-xs text-muted-foreground">
          Renewals vs drop-offs by first-membership start month (last {cohorts.length} cohorts)
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={Percent} tone="primary" label="Retention Rate" value={totals.retentionRate == null ? '—' : `${totals.retentionRate}%`} sub="Renewed of decided" />
        <StatCard icon={Repeat} tone="accent" label="Renewed" value={totals.totalRenewed} sub="Took a 2nd plan" />
        <StatCard icon={TrendingDown} tone="danger" label="Dropped Off" value={totals.totalDropped} sub="Lapsed, no renewal" />
        <StatCard icon={Activity} tone="info" label="Still Active" value={totals.totalActive} sub="On first plan" />
      </div>

      {/* Cohort chart */}
      <div className="glass-card rounded-2xl p-5">
        <div className="mb-4">
          <h4 className="font-heading text-sm font-bold text-foreground">Cohort Retention Over Time</h4>
          <p className="text-xs text-muted-foreground">Each bar = members who first joined that month</p>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cohorts} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="renewed" name="Renewed" stackId="a" fill="hsl(var(--primary))" maxBarSize={44} />
              <Bar dataKey="active" name="Still active" stackId="a" fill="hsl(var(--chart-3))" maxBarSize={44} />
              <Bar dataKey="droppedOff" name="Dropped off" stackId="a" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, tone }) {
  const tones = {
    info: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
    primary: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
    danger: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300',
    accent: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300',
  };
  return (
    <div className="glass-card flex items-center gap-3 rounded-2xl p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate font-heading text-lg font-bold text-foreground">{value}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}