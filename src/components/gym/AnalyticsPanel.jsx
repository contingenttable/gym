import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell,
} from 'recharts';
import { Clock, CalendarDays, Flame, Activity, Gauge } from 'lucide-react';
import EmptyState from '@/components/gym/EmptyState';

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 0, label: 'All time' },
];

// Hour buckets covering a typical gym day: 5 AM → 11 PM
const HOUR_BUCKETS = Array.from({ length: 18 }, (_, i) => i + 5); // 5..22

const HOUR_LABEL = (h) => {
  const period = h < 12 ? 'AM' : 'PM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${period}`;
};

// Two-hour slots for the heatmap (5 AM → 11 PM)
const SLOTS = [
  { start: 5, end: 7, label: '5–7a' },
  { start: 7, end: 9, label: '7–9a' },
  { start: 9, end: 11, label: '9–11a' },
  { start: 11, end: 13, label: '11a–1p' },
  { start: 13, end: 15, label: '1–3p' },
  { start: 15, end: 17, label: '3–5p' },
  { start: 17, end: 19, label: '5–7p' },
  { start: 19, end: 21, label: '7–9p' },
  { start: 21, end: 23, label: '9–11p' },
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const tooltipStyle = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 12,
  fontSize: 12,
};

export default function AnalyticsPanel({ attendance }) {
  const [range, setRange] = useState(30);

  const analysis = useMemo(() => {
    const now = new Date();
    const cutoff = range > 0 ? new Date(now.getTime() - range * 24 * 60 * 60 * 1000) : null;
    const records = attendance.filter((a) => {
      if (!a.timestamp) return false;
      const d = new Date(a.timestamp);
      if (isNaN(d.getTime())) return false;
      return !cutoff || d >= cutoff;
    });

    // by hour of day
    const hourCounts = {};
    for (const h of HOUR_BUCKETS) hourCounts[h] = 0;
    // by day of week
    const dayCounts = {};
    for (const d of WEEKDAYS) dayCounts[d] = 0;
    // heatmap [dayIndex][slotIndex]
    const heat = Array.from({ length: 7 }, () => SLOTS.map(() => 0));

    for (const a of records) {
      const d = new Date(a.timestamp);
      const h = d.getHours();
      if (h >= 5 && h <= 22) {
        hourCounts[h] = (hourCounts[h] || 0) + 1;
        // js getDay: 0=Sun..6=Sat → convert to Mon-first index
        const dayIdx = (d.getDay() + 6) % 7;
        dayCounts[WEEKDAYS[dayIdx]] += 1;
        const slotIdx = SLOTS.findIndex((s) => h >= s.start && h < s.end);
        if (slotIdx >= 0) heat[dayIdx][slotIdx] += 1;
      }
    }

    const hourData = HOUR_BUCKETS.map((h) => ({ hour: HOUR_LABEL(h), count: hourCounts[h] }));
    const dayData = WEEKDAYS.map((d) => ({ day: d, count: dayCounts[d] }));

    const peakHourEntry = hourData.reduce((max, x) => (x.count > max.count ? x : max), { hour: '—', count: 0 });
    const peakDayEntry = dayData.reduce((max, x) => (x.count > max.count ? x : max), { day: '—', count: 0 });

    // busiest heatmap cell
    let maxHeat = 0;
    let busyCell = null;
    for (let di = 0; di < 7; di++) {
      for (let si = 0; si < SLOTS.length; si++) {
        if (heat[di][si] > maxHeat) {
          maxHeat = heat[di][si];
          busyCell = { day: WEEKDAYS[di], slot: SLOTS[si].label };
        }
      }
    }

    const maxDayCount = Math.max(1, ...dayData.map((d) => d.count));

    return {
      records: records.length,
      hourData, dayData, heat,
      peakHour: peakHourEntry.count ? `${peakHourEntry.hour}` : '—',
      peakDay: peakDayEntry.count ? peakDayEntry.day : '—',
      busySlot: busyCell ? `${busyCell.day} ${busyCell.slot}` : '—',
      avgPerDay: range > 0 ? (records.length / range) : (records.length / 7),
      maxDayCount,
    };
  }, [attendance, range]);

  const hasData = analysis.records > 0;

  return (
    <div className="space-y-5">
      {/* Range selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-bold text-foreground">Peak-Hours Analytics</h3>
          <p className="text-xs text-muted-foreground">
            {analysis.records} check-ins analysed · avg {analysis.avgPerDay.toFixed(1)} / day
          </p>
        </div>
        <div className="inline-flex rounded-lg bg-muted p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              className={
                'rounded-md px-3 py-1 text-xs font-medium transition-all ' +
                (range === r.value
                  ? 'bg-background text-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground')
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Insight cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <InsightCard icon={Clock} tone="info" label="Peak Hour" value={analysis.peakHour} sub="Busiest hour of day" />
        <InsightCard icon={CalendarDays} tone="primary" label="Peak Day" value={analysis.peakDay} sub="Busiest weekday" />
        <InsightCard icon={Flame} tone="danger" label="Hottest Slot" value={analysis.busySlot} sub="Day × time combo" />
        <InsightCard icon={Gauge} tone="accent" label="Avg / Day" value={analysis.avgPerDay.toFixed(1)} sub="Check-ins per day" />
      </div>

      {!hasData ? (
        <EmptyState
          icon={Activity}
          title="No attendance data yet"
          description="Check-ins in the selected range will show peak-hour patterns here."
        />
      ) : (
        <>
          {/* Hour-of-day chart */}
          <div className="glass-card rounded-2xl p-5">
            <div className="mb-4">
              <h4 className="font-heading text-sm font-bold text-foreground">Check-ins by Time of Day</h4>
              <p className="text-xs text-muted-foreground">Identify your busiest operating hours</p>
            </div>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysis.hourData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={1} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={28}>
                    {analysis.hourData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.hour === analysis.peakHour ? 'hsl(var(--chart-3))' : 'hsl(var(--primary))'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Day-of-week chart */}
            <div className="glass-card rounded-2xl p-5">
              <div className="mb-4">
                <h4 className="font-heading text-sm font-bold text-foreground">Check-ins by Day of Week</h4>
                <p className="text-xs text-muted-foreground">Weekly traffic distribution</p>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.dayData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Heatmap */}
            <div className="glass-card rounded-2xl p-5">
              <div className="mb-4">
                <h4 className="font-heading text-sm font-bold text-foreground">Peak Heatmap</h4>
                <p className="text-xs text-muted-foreground">Day × time-slot intensity</p>
              </div>
              <Heatmap heat={analysis.heat} />
              <div className="mt-3 flex items-center justify-end gap-1.5">
                <span className="text-[11px] text-muted-foreground">Less</span>
                {[0.12, 0.3, 0.5, 0.7, 1].map((o) => (
                  <span
                    key={o}
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: `rgba(5, 150, 105, ${o})` }}
                  />
                ))}
                <span className="text-[11px] text-muted-foreground">More</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function InsightCard({ icon: Icon, label, value, sub, tone }) {
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

function Heatmap({ heat }) {
  const max = Math.max(1, ...heat.flat());
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <div className="min-w-[420px]">
        {/* slot header */}
        <div className="mb-1 flex pl-9">
          {SLOTS.map((s) => (
            <div key={s.label} className="flex-1 text-center text-[10px] font-medium text-muted-foreground">
              {s.label}
            </div>
          ))}
        </div>
        {WEEKDAYS.map((day, di) => (
          <div key={day} className="mb-1 flex items-center">
            <div className="w-9 pr-2 text-right text-[11px] font-medium text-muted-foreground">{day}</div>
            <div className="flex flex-1 gap-1">
              {SLOTS.map((_, si) => {
                const count = heat[di][si];
                const intensity = count === 0 ? 0.06 : 0.12 + 0.88 * (count / max);
                return (
                  <div
                    key={si}
                    className="group relative flex-1 rounded-md transition-all"
                    style={{ backgroundColor: `rgba(5, 150, 105, ${intensity})` }}
                    title={`${day} ${SLOTS[si].label} · ${count} check-ins`}
                  >
                    {count > 0 && (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white/90">
                        {count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}