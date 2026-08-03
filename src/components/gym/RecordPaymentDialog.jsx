const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useMemo, useState } from 'react';

import { IndianRupee, Wallet } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  PAYMENT_MODES, formatCurrency, formatDate, todayISO,
  nextReceiptNumber, computeBalance, logAudit,
} from '@/lib/gym';
import { useToast } from '@/components/ui/use-toast';

export default function RecordPaymentDialog({ open, onOpenChange, member, memberships = [], existingPayments = [], onSaved }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [mode, setMode] = useState('cash');
  const [membershipId, setMembershipId] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const activeMemberships = useMemo(
    () => memberships.filter((m) => m.status !== 'cancelled'),
    [memberships]
  );

  useEffect(() => {
    if (open && activeMemberships.length) {
      // preselect latest membership
      const latest = [...activeMemberships].sort((a, b) => new Date(b.end_date) - new Date(a.end_date))[0];
      setMembershipId(latest.id);
      setAmount(String(latest.fee || ''));
    } else if (open) {
      setMembershipId('');
      setAmount('');
    }
    setPaymentDate(todayISO());
    setMode('cash');
    setReference('');
    setNotes('');
  }, [open]);

  const selectedMembership = activeMemberships.find((m) => m.id === membershipId);
  const balance = selectedMembership ? computeBalance(selectedMembership, existingPayments) : 0;

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' });
      return;
    }
    if (amt > 500000) {
      toast({ title: 'Amount looks unusually high', description: 'Please verify before saving.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const receipt = await nextReceiptNumber('RCP');
      const payment = await db.entities.Payment.create({
        member_id: member.id,
        member_name: member.full_name,
        membership_id: membershipId || '',
        amount: amt,
        payment_date: paymentDate,
        mode,
        reference_number: reference,
        receipt_number: receipt,
        notes,
        status: 'active',
      });
      await logAudit({ action: 'payment.create', entity: 'Payment', entity_id: payment.id, new_value: { amount: amt, mode, receipt }, reason: 'Payment recorded' });
      toast({ title: 'Payment recorded', description: receipt });
      onOpenChange(false);
      onSaved?.(payment);
    } catch (e) {
      toast({ title: 'Failed to record payment', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><IndianRupee className="h-5 w-5 text-primary" /> Record Payment</DialogTitle>
          <DialogDescription>{member?.full_name} · {member?.member_id}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {selectedMembership && (
            <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground"><Wallet className="h-4 w-4" /> Outstanding balance</span>
              <span className="font-bold text-foreground">{formatCurrency(balance)}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Apply to membership</Label>
            <Select value={membershipId || '_'} onValueChange={(v) => setMembershipId(v === '_' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="No specific membership" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_">No specific membership</SelectItem>
                {activeMemberships.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.plan_name} · {formatDate(m.end_date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Amount (₹)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Payment date</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Payment mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Reference number (optional)</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no." />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Record payment'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}