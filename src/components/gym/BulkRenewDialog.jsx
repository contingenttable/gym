const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useMemo, useState } from 'react';

import { RefreshCw, Calendar, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { addDays, formatCurrency, formatDate, todayISO, daysRemaining, logAudit } from '@/lib/gym';
import { useToast } from '@/components/ui/use-toast';

export default function BulkRenewDialog({ open, onOpenChange, selectedMembers = [], latestMembershipByMember = {}, plans = [], onDone }) {
  const { toast } = useToast();
  const [planId, setPlanId] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [customDuration, setCustomDuration] = useState('');
  const [customFee, setCustomFee] = useState('');
  const [discount, setDiscount] = useState('');
  const [saving, setSaving] = useState(false);

  const activePlans = useMemo(() => plans.filter((p) => p.active), [plans]);

  useEffect(() => {
    if (open && activePlans.length && !planId) setPlanId(activePlans[0].id);
    if (open) {
      setUseCustom(false);
      setCustomDuration('');
      setCustomFee('');
      setDiscount('');
    }
  }, [open]);

  const selectedPlan = activePlans.find((p) => p.id === planId);
  const durationDays = useCustom ? Number(customDuration) : (selectedPlan?.duration_days ?? 0);
  const baseFee = useCustom ? Number(customFee) : (selectedPlan?.standard_fee ?? 0);
  const discountAmt = Math.max(0, Number(discount) || 0);
  const netFee = Math.max(0, baseFee - discountAmt);

  const computeRange = (memberId) => {
    const current = latestMembershipByMember[memberId];
    const start = (current && daysRemaining(current.end_date) >= 0 && current.status !== 'cancelled')
      ? addDays(current.end_date, 1)
      : todayISO();
    const end = durationDays > 0 ? addDays(start, durationDays) : '';
    return { start, end };
  };

  const submit = async () => {
    if (durationDays <= 0) {
      toast({ title: 'Set a valid duration', variant: 'destructive' });
      return;
    }
    if (selectedMembers.length === 0) {
      toast({ title: 'No members selected', variant: 'destructive' });
      return;
    }
    setSaving(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const member of selectedMembers) {
        const { start, end } = computeRange(member.id);
        if (!start || !end) { fail += 1; continue; }
        try {
          const membership = await db.entities.Membership.create({
            member_id: member.id,
            plan_id: selectedPlan?.id || '',
            plan_name: useCustom ? 'Custom' : (selectedPlan?.name || 'Custom'),
            start_date: start,
            end_date: end,
            fee: netFee,
            discount: discountAmt,
            status: 'active',
            notes: '',
          });
          await db.entities.MembershipEvent.create({
            membership_id: membership.id,
            member_id: member.id,
            type: 'renewal',
            reason: useCustom ? `Bulk custom (${durationDays} days)` : `Bulk renewed with ${selectedPlan?.name}`,
          });
          await logAudit({ action: 'membership.renew', entity: 'Membership', entity_id: membership.id, new_value: { plan: membership.plan_name, end, bulk: true }, reason: 'Bulk renewal' });
          ok += 1;
        } catch {
          fail += 1;
        }
      }
      if (fail === 0) toast({ title: `Renewed ${ok} member${ok !== 1 ? 's' : ''}`, description: useCustom ? `Custom · ${durationDays} days` : selectedPlan?.name });
      else toast({ title: `Renewed ${ok}, ${fail} failed`, variant: 'destructive' });
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      toast({ title: 'Bulk renewal failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const preview = selectedMembers[0] ? computeRange(selectedMembers[0].id) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" /> Bulk Renew Memberships</DialogTitle>
          <DialogDescription>{selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected · each plan extends by the same duration</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">Custom membership</p>
              <p className="text-xs text-muted-foreground">Set duration & fee manually</p>
            </div>
            <Switch checked={useCustom} onCheckedChange={setUseCustom} />
          </div>

          {!useCustom ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Plan</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger><SelectValue placeholder="Select a plan" /></SelectTrigger>
                <SelectContent>
                  {activePlans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} · {p.duration_days} days · {formatCurrency(p.standard_fee)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Duration (days)</Label>
                <Input type="number" min="1" value={customDuration} onChange={(e) => setCustomDuration(e.target.value)} placeholder="e.g. 30" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Fee (₹)</Label>
                <Input type="number" min="0" value={customFee} onChange={(e) => setCustomFee(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Discount per member (₹)</Label>
            <Input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="optional" />
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-primary/5 px-3 py-3 text-sm">
            <Calendar className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <p className="font-semibold text-foreground">{durationDays > 0 ? `${durationDays} days added to each member` : 'Pick a plan or duration'}</p>
              <p className="text-xs text-muted-foreground">
                {discountAmt > 0
                  ? `Fee ${formatCurrency(baseFee)} − ${formatCurrency(discountAmt)} = ${formatCurrency(netFee)} / member`
                  : `Fee: ${formatCurrency(netFee)} / member`}
              </p>
              {preview?.end && <p className="mt-0.5 text-xs text-muted-foreground">e.g. {formatDate(preview.start)} → {formatDate(preview.end)}</p>}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Renewing…</>) : `Renew ${selectedMembers.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}