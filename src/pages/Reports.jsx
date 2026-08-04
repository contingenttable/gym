import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { FileBarChart, Download, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import EmptyState from '@/components/gym/EmptyState';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ReportsAnalytics from '@/components/gym/ReportsAnalytics';
import {
  exportToCSV, formatCurrency, formatDate, deriveStatus, PAYMENT_MODE_LABEL, todayISO,
} from '@/lib/gym';

const REPORTS = [
  { value: 'members', label: 'All Members' },
  { value: 'active', label: 'Active Memberships' },
  { value: 'expired', label: 'Expired Memberships' },
  { value: 'expiring', label: 'Expiring Soon' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'payments', label: 'Payments / Collection' },
  { value: 'new_members', label: 'New Members' },
];

export default function Reports() {
  const { settings } = useOutletContext();
  const [type, setType] = useState('members');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(todayISO());
  const [mode, setMode] = useState('all');
  const [data, setData] = useState({ members: [], memberships: [], payments: [], attendance: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [members, memberships, payments, attendance] = await Promise.all([
          db.entities.Member.list('-created_date', 1000),
          db.entities.Membership.list('-created_date', 1000),
          db.entities.Payment.list('-created_date', 500),
          db.entities.Attendance.list('-created_date', 500),
        ]);
        setData({ members, memberships, payments, attendance });
      } catch (e) {
        setLoadError(e?.message || 'Failed to load report data.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const symbol = settings?.currency_symbol || '₹';
  const warningDays = settings?.expiry_warning_days ?? 7;

  const memberMap = useMemo(() => {
    const map = {};
    data.members.forEach((m) => { map[m.id] = m; });
    return map;
  }, [data.members]);

  const inRange = (dateStr) => {
    if (!from && !to) return true;
    const d = dateStr || '';
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };

  const { rows, columns, title } = useMemo(() => {
    const mCols = [
      { label: 'Member ID', value: 'member_id' },
      { label: 'Name', value: 'full_name' },
      { label: 'Mobile', value: 'mobile' },
      { label: 'Email', value: (r) => r.email || '' },
      { label: 'Joining Date', value: (r) => formatDate(r.joining_date) },
      { label: 'Status', value: 'status' },
    ];
    const latestByMember = {};
    for (const m of data.memberships) {
      const cur = latestByMember[m.member_id];
      if (!cur || new Date(m.end_date) > new Date(cur.end_date)) latestByMember[m.member_id] = m;
    }

    switch (type) {
      case 'members':
        return { title: 'All Members', columns: mCols, rows: data.members.filter((m) => m.status !== 'archived') };
      case 'active':
        return {
          title: 'Active Memberships',
          columns: memCols(symbol),
          rows: data.memberships.filter((m) => deriveStatus(m, warningDays) === 'active'),
        };
      case 'expired':
        return {
          title: 'Expired Memberships',
          columns: memCols(symbol),
          rows: data.memberships.filter((m) => deriveStatus(m, warningDays) === 'expired'),
        };
      case 'expiring':
        return {
          title: 'Expiring Soon',
          columns: memCols(symbol),
          rows: data.memberships.filter((m) => deriveStatus(m, warningDays) === 'expiring_soon'),
        };
      case 'attendance':
        return {
          title: 'Attendance',
          columns: [
            { label: 'Member', value: (r) => r.member_name || memberMap[r.member_id]?.full_name || '' },
            { label: 'Date', value: (r) => formatDate(r.date) },
            { label: 'Time', value: (r) => new Date(r.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) },
            { label: 'Method', value: (r) => r.method },
          ],
          rows: data.attendance.filter((a) => inRange(a.date)),
        };
      case 'payments':
        return {
          title: 'Payments / Collection',
          columns: [
            { label: 'Receipt', value: 'receipt_number' },
            { label: 'Member', value: (r) => r.member_name || memberMap[r.member_id]?.full_name || '' },
            { label: 'Date', value: (r) => formatDate(r.payment_date) },
            { label: 'Mode', value: (r) => PAYMENT_MODE_LABEL[r.mode] || r.mode },
            { label: 'Amount', value: (r) => formatCurrency(r.amount, symbol) },
            { label: 'Status', value: 'status' },
          ],
          rows: data.payments
            .filter((p) => inRange(p.payment_date))
            .filter((p) => mode === 'all' || p.mode === mode),
        };
      case 'new_members':
        return {
          title: 'New Members',
          columns: mCols,
          rows: data.members.filter((m) => inRange(m.joining_date)),
        };
      default:
        return { title: '', columns: [], rows: [] };
    }
  }, [type, data, from, to, mode, symbol, warningDays]);

  const total = type === 'payments'
    ? rows.filter((r) => r.status !== 'voided').reduce((s, r) => s + Number(r.amount || 0), 0)
    : null;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-destructive">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">{rows.length} records · {title}</p>
        </div>
        {rows.length > 0 && (
          <Button variant="outline" onClick={() => exportToCSV(`${type}_${todayISO()}.csv`, rows, columns)}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        )}
      </div>

      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="max-w-xs">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-4">
          <ReportsAnalytics members={data.members} memberships={data.memberships} payments={data.payments} attendance={data.attendance} settings={settings} />
        </TabsContent>

        <TabsContent value="reports" className="mt-5 space-y-5">
      <div className="glass-card rounded-2xl p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Report</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REPORTS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {(type === 'attendance' || type === 'payments' || type === 'new_members') && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">From</label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">To</label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          )}
          {type === 'payments' && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Mode</label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modes</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {total !== null && (
          <div className="mt-3 flex items-center justify-end text-sm">
            <span className="text-muted-foreground">Total collected: </span>
            <span className="ml-1 font-bold text-foreground">{formatCurrency(total, symbol)}</span>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={FileBarChart} title="No records for this report" description="Adjust the filters or date range." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {columns.map((c) => <th key={c.label} className="px-4 py-3 whitespace-nowrap">{c.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.slice(0, 200).map((r, i) => (
                  <tr key={r.id ?? `row-${i}`} className="hover:bg-muted/40">
                    {columns.map((c) => (
                      <td key={c.label} className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                        {typeof c.value === 'function' ? c.value(r) : (r[c.value] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 200 && <p className="px-4 py-2 text-center text-xs text-muted-foreground">Showing first 200 of {rows.length}. Export CSV for the full list.</p>}
        </div>
      )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function memCols(symbol) {
  return [
    { label: 'Member ID', value: (r) => r.member_id },
    { label: 'Plan', value: 'plan_name' },
    { label: 'Start', value: (r) => formatDate(r.start_date) },
    { label: 'End', value: (r) => formatDate(r.end_date) },
    { label: 'Fee', value: (r) => formatCurrency(r.fee, symbol) },
    { label: 'Status', value: (r) => deriveStatus(r, 7) },
  ];
}