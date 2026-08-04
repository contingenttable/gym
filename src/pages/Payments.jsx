﻿import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { printReceipt as printReceiptLib } from '@/lib/printReceipt';
import { cache } from '@/lib/dataCache';

import { IndianRupee, Search, Plus, Printer, Ban, Wallet } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import MemberAvatar from '@/components/gym/MemberAvatar';
import EmptyState from '@/components/gym/EmptyState';
import MemberPickerDialog from '@/components/gym/MemberPickerDialog';
import RecordPaymentDialog from '@/components/gym/RecordPaymentDialog';
import WakingUp from '@/components/gym/WakingUp';
import {
  formatCurrency, formatDate, PAYMENT_MODE_LABEL, todayISO, logAudit, computeBalance, can,
} from '@/lib/gym';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const MODES = [
  { value: 'all', label: 'All modes' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card / Offline POS' },
  { value: 'other', label: 'Other' },
];

const DATES = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'month', label: 'This month' },
];

export default function Payments() {
  const { settings } = useOutletContext();
  const { toast } = useToast();
  const { user } = useAuth();
  const symbol = settings?.currency_symbol || '₹';
  const CACHE_KEY = 'payments';
  const [payments, setPayments]       = useState(cache.get(CACHE_KEY)?.payments || []);
  const [members, setMembers]         = useState(cache.get(CACHE_KEY)?.members || []);
  const [memberships, setMemberships] = useState(cache.get(CACHE_KEY)?.memberships || []);
  const [loading, setLoading]         = useState(!cache.get(CACHE_KEY));
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('all');
  const [searchParams, setSearchParams] = useSearchParams();
  const dateFilter = searchParams.get('date') || 'all';
  const setDateFilter = (v) => {
    const next = new URLSearchParams(searchParams);
    if (v === 'all') next.delete('date');
    else next.set('date', v);
    setSearchParams(next, { replace: true });
  };
  const [pickerOpen, setPickerOpen] = useState(false);
  const [payMember, setPayMember]   = useState(null);
  const [payOpen, setPayOpen]       = useState(false);
  const [voidItem, setVoidItem]     = useState(null);
  const [voidReason, setVoidReason] = useState('');

  const load = async (silent = false) => {
    try {
      const [p, m, ms] = await Promise.all([
        db.entities.Payment.list('-created_date', 500),
        db.entities.Member.list('-created_date', 1000),
        db.entities.Membership.list('-created_date', 1000),
      ]);
      cache.set(CACHE_KEY, { payments: p, members: m, memberships: ms });
      setPayments(p);
      setMembers(m);
      setMemberships(ms);
    } catch (e) {
      console.error('Payments load failed:', e);
    } finally {
      if (!silent) setLoading(false);
    }
  };
  useEffect(() => {
    const cached = cache.get(CACHE_KEY);
    if (cached) { load(true); } else { load(false); }
  }, []);

  const memberMap = useMemo(() => {
    const map = {};
    members.forEach((m) => { map[m.id] = m; });
    return map;
  }, [members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = new Date();
    return payments
      .filter((p) => mode === 'all' || p.mode === mode)
      .filter((p) => {
        if (dateFilter === 'today') return p.payment_date === todayISO();
        if (dateFilter === 'month') {
          const d = new Date(p.payment_date);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        return true;
      })
      .filter((p) => {
        if (!q) return true;
        const m = memberMap[p.member_id];
        return (p.member_name || m?.full_name || '').toLowerCase().includes(q) ||
          (m?.member_id || '').toLowerCase().includes(q) ||
          (p.receipt_number || '').toLowerCase().includes(q);
      });
  }, [payments, mode, dateFilter, query, memberMap]);

  const totalCollected = filtered.filter((p) => p.status !== 'voided').reduce((s, p) => s + Number(p.amount || 0), 0);
  const todayTotal = filtered.filter((p) => p.status !== 'voided' && p.payment_date === todayISO()).reduce((s, p) => s + Number(p.amount || 0), 0);

  const handlePick = (m) => {
    setPickerOpen(false);
    setPayMember(m);
    setPayOpen(true);
  };

  const printReceipt = (p) => {
    const m = memberMap[p.member_id];
    printReceiptLib({ payment: p, member: m, settings, symbol });
  };


  const handleVoid = async () => {
    try {
      await db.entities.Payment.update(voidItem.id, { status: 'voided' });
      await db.entities.PaymentAdjustment.create({
        payment_id: voidItem.id,
        original_amount: voidItem.amount,
        corrected_amount: 0,
        reason: voidReason,
      });
      await logAudit({ action: 'payment.correct', entity: 'Payment', entity_id: voidItem.id, previous_value: { amount: voidItem.amount }, new_value: { status: 'voided' }, reason: voidReason });
      cache.invalidate('payments');
      toast({ title: 'Payment voided' });
      setVoidItem(null); setVoidReason('');
      load(true);
    } catch (e) { toast({ title: 'Failed', description: e.message, variant: 'destructive' }); }
  };

  if (loading) {
    return (
      <>
        <WakingUp loading={loading} />
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
        </div>
      </>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Payments / Fee Ledger</h1>
          <p className="text-sm text-muted-foreground"><span className="tnum">{filtered.length}</span> transactions · <span className="tnum">{formatCurrency(totalCollected, symbol)}</span> collected</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm">
          <Wallet className="h-4 w-4 text-emerald-600" />
          <span className="font-semibold text-emerald-700 dark:text-emerald-300 tnum">Today: {formatCurrency(todayTotal, symbol)}</span>
        </div>
        {can(user, 'payment.create') && (
          <Button onClick={() => setPickerOpen(true)}><Plus className="mr-2 h-4 w-4" /> Record Payment</Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search member, receipt no…" className="pl-9" />
        </div>
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{DATES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={IndianRupee} title="No payments recorded" description="Record your first payment to start the fee ledger."
          action={can(user, 'payment.create') ? <Button onClick={() => setPickerOpen(true)}><Plus className="mr-2 h-4 w-4" /> Record Payment</Button> : undefined} />
      ) : (
        <>
          {/* Desktop ledger */}
          <div className="hidden overflow-hidden rounded-2xl border border-border/60 bg-card md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Receipt</th>
                  <th className="px-5 py-3">Mode</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((p) => {
                  const m = memberMap[p.member_id];
                  const voided = p.status === 'voided';
                  return (
                    <tr key={p.id} className={voided ? 'opacity-50 hover:bg-muted/40' : 'hover:bg-muted/40'}>
                      <td className="px-5 py-3 text-muted-foreground tnum">{formatDate(p.payment_date)}</td>
                      <td className="px-5 py-3">
                        <Link to={`/members/${p.member_id}`} className="flex items-center gap-2.5">
                          <MemberAvatar member={m} size="sm" />
                          <span className="font-semibold text-foreground">{m?.full_name || p.member_name}</span>
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground tnum">{p.receipt_number}</td>
                      <td className="px-5 py-3 text-muted-foreground">{PAYMENT_MODE_LABEL[p.mode]}</td>
                      <td className="px-5 py-3 text-right font-bold text-foreground tnum">{formatCurrency(p.amount, symbol)}</td>
                      <td className="px-5 py-3">
                        {voided
                          ? <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">VOIDED</span>
                          : <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Active</span>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => printReceipt(p)}><Printer className="h-4 w-4" /></Button>
                          {!voided && can(user, 'payment.correct') && (
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setVoidItem(p)}><Ban className="h-4 w-4" /></Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2.5 md:hidden">
            {filtered.map((p) => {
              const m = memberMap[p.member_id];
              const voided = p.status === 'voided';
              return (
                <div key={p.id} className={`glass-card flex items-center gap-3 rounded-2xl p-3.5 ${voided ? 'opacity-50' : ''}`}>
                  <MemberAvatar member={m} size="md" />
                  <Link to={`/members/${p.member_id}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{m?.full_name || p.member_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.receipt_number} · {PAYMENT_MODE_LABEL[p.mode]} · {formatDate(p.payment_date)}</p>
                  </Link>
                  <div className="text-right">
                    <p className="font-bold text-foreground tnum">{formatCurrency(p.amount, symbol)}</p>
                    {voided && <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">VOIDED</span>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="ghost" onClick={() => printReceipt(p)}><Printer className="h-4 w-4" /></Button>
                    {!voided && can(user, 'payment.correct') && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setVoidItem(p)}><Ban className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <MemberPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onPick={handlePick} title="Record payment for" />
      {payMember && (
        <RecordPaymentDialog
          open={payOpen}
          onOpenChange={(o) => { setPayOpen(o); if (!o) setPayMember(null); }}
          member={payMember}
          memberships={memberships.filter((x) => x.member_id === payMember.id)}
          existingPayments={payments.filter((x) => x.member_id === payMember.id)}
          onSaved={load}
        />
      )}

      <Dialog open={!!voidItem} onOpenChange={(o) => { if (!o) { setVoidItem(null); setVoidReason(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Ban className="h-5 w-5 text-destructive" /> Void payment?</DialogTitle>
            <DialogDescription>Receipt {voidItem?.receipt_number} · {formatCurrency(voidItem?.amount || 0, symbol)}. A reason is required.</DialogDescription>
          </DialogHeader>
          <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} rows={3} placeholder="e.g. Wrong amount, duplicate" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setVoidItem(null); setVoidReason(''); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleVoid} disabled={!voidReason.trim()}>Void payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

