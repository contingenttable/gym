import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, PieChart as PieIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/gym';
import EmptyState from '@/components/gym/EmptyState';
import RetentionChart from '@/components/gym/RetentionChart';
import AnalyticsPanel from '@/components/gym/AnalyticsPanel';

const tooltipStyle = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 12,
  fontSize: 12,
};
const PIE_COLORS = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--primary))',
];

function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function monthLabel(d) { return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }); }

export default function ReportsAnalytics({ members, memberships, payments, attendance, settings }) {
  const symbol = settings?.currency_symbol || '₹';

  const revenueSeries = useMemo(() => {
    const buckets = {};
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets[monthKey(d)] = { label: monthLabel(d), amount: 0 };
    }
    for (const p of payments || []) {
      if (p.status === 'voided' || !p.payment_date) continue;
      const d = new Date(p.payment_date);
      const k = monthKey(d);
      if (buckets[k]) buckets[k].amount += Number(p.amount || 0);
    }
    return Object.values(buckets);
  }, [payments]);

  const planMix = useMemo(() => {
    const counts = {};
    for (const m of memberships || []) {
      if (m.plan_name) counts[m.plan_name] = (counts[m.plan_name] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [memberships]);

  const totalRevenue = revenueSeries.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Revenue trend */}
        <div className="glass-card rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="font-heading text-sm font-bold text-foreground">Revenue Trend</h3>
            </div>
            <span className="text-sm font-semibold text-foreground tnum">{formatCurrency(totalRevenue, symbol)}</span>
          </div>
          {revenueSeries.every((r) => !r.amount) ? (
            <EmptyState icon={TrendingUp} title="No revenue yet" description="Collected payments will plot here monthly." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueSeries} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(v, symbol)} />
                  <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Plan mix */}
        <div className="glass-card rounded-2xl p-5">
          <div className="mb-3 flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-primary" />
            <h3 className="font-heading text-sm font-bold text-foreground">Plan Mix</h3>
          </div>
          {planMix.length === 0 ? (
            <EmptyState icon={PieIcon} title="No plans assigned" description="Memberships grouped by plan will appear here." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={planMix} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {planMix.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Cohort retention */}
      <RetentionChart memberships={memberships} />

      {/* Attendance analytics */}
      <div className="glass-card rounded-2xl p-5">
        <AnalyticsPanel attendance={attendance} />
      </div>
    </div>
  );
}