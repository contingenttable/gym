import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Calendar, ArrowUpDown } from 'lucide-react';
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

export default function RenewDialog({
  open, onOpenChange, member, currentMembership, plans = [], onSaved, mode = 'renew',
}) {
  const isSwitch = mode === 'switch';
  const { toast } = useToast();
  const [planId, setPlanId]             = useState('');
  const [customStart, setCustomStart]   = useState('');
  const [useCustom, setUseCustom]       = useState(false);
  const [customDuration, setCustomDuration] = useState('');
  const [customFee, setCustomFee]       = useState('');
  const [discount, setDiscount]         = useState('');
  const [saving, setSaving]             = useState(false);

  const activePlans = useMemo(() => plans.filter((p) => p.active), [plans]);

  useEffect(() => {
    if (open) {
      if (activePlans.length && !planId) setPlanId(activePlans[0].id);
      setUseCustom(false);
      setCustomDuration('');
      setCustomFee('');
      setDiscount('');
      setCustomStart('');
    }
  }, [open]);

  const selectedPlan    = activePlans.find((p) => p.id === planId);
  const durationDays    = useCustom ? Number(customDuration) : (selectedPlan?.duration_days ?? 0);
  const baseFee         = useCustom ? Number(customFee) : (selectedPlan?.standard_fee ?? 0);
  const discountAmt     = Math.max(0, Number(discount) || 0);
  const netFee          = Math.max(0, baseFee - discountAmt);

  // Compute start / end for the renewal
  const computeRange = () => {
    let start;
    if (customStart) {
      start = customStart;
    } else if (isSwitch && currentMembership) {
      start = todayISO();
    } else if (currentMembership && daysRemaining(currentMembership.end_date) >= 0 && currentMembership.status !== 'cancelled') {
      start = addDays(currentMembership.end_date, 1);
    } else {
      start = todayISO();
    }
    const end = durationDays > 0 ? addDays(start, durationDays) : '';
    return { start, end };
  };

  const { start: previewStart, end: previewEnd } = computeRange();

  const save = async () => {
    if (durationDays <= 0) {
      toast({ title: 'Set a valid duration', variant: 'destructive' });
      return;
    }
    const { start, end } = computeRange();
    if (!start || !end) {
      toast({ title: 'Invalid date range', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const membership = await globalThis.db.entities.Membership.create({
        member_id:  member.id,
        plan_id:    selectedPlan?.id || '',
        plan_name:  useCustom ? 'Custom' : (selectedPlan?.name || 'Custom'),
        start_date: start,
        end_date:   end,
        fee:        netFee,
        discount:   discountAmt,
        status:     'active',
        notes:      '',
      });

      await globalThis.db.entities.MembershipEvent.create({
        membership_id: membership.id,
        member_id:     member.id,
        type:          isSwitch ? 'renewal' : 'renewal',
        reason:        isSwitch
          ? `Switched to ${membership.plan_name}`
          : `Renewed with ${membership.plan_name}`,
      });

      await logAudit({
        action:    isSwitch ? 'membership.switch' : 'membership.renew',
        entity:    'Membership',
        entity_id: membership.id,
        new_value: { plan: membership.plan_name, end, fee: netFee },
        reason:    isSwitch ? 'Plan switch' : 'Renewal',
      });

      toast({ title: isSwitch ? 'Plan switched' : 'Membership renewed', description: `${membership.plan_name} · ${formatDate(end)}` });
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSwitch
              ? <><ArrowUpDown className="h-5 w-5 text-primary" /> Switch Plan</>
              : <><RefreshCw className="h-5 w-5 text-primary" /> Renew Membership</>}
          </DialogTitle>
          <DialogDescription>{member?.full_name} · {member?.member_id}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Custom toggle */}
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
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.duration_days} days · {formatCurrency(p.standard_fee)}
                    </SelectItem>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Discount (₹, optional)</Label>
              <Input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Custom start (optional)</Label>
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 rounded-xl bg-primary/5 px-3 py-3 text-sm">
            <Calendar className="h-4 w-4 text-primary" />
            <div>
              <p className="font-semibold text-foreground">
                {durationDays > 0 ? `${durationDays} days` : 'Pick a plan or duration'}
              </p>
              <p className="text-xs text-muted-foreground">
                {discountAmt > 0
                  ? `${formatCurrency(baseFee)} − ${formatCurrency(discountAmt)} = ${formatCurrency(netFee)}`
                  : `Fee: ${formatCurrency(netFee)}`}
                {previewEnd ? ` · ${formatDate(previewStart)} → ${formatDate(previewEnd)}` : ''}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : isSwitch ? 'Switch plan' : 'Renew'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
