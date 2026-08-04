import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { Plus, IdCard, Layers, BadgeCheck, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import EmptyState from '@/components/gym/EmptyState';
import PlanCard from '@/components/gym/PlanCard';
import { formatCurrency, logAudit } from '@/lib/gym';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

const EMPTY = { name: '', duration_days: 30, standard_fee: 0, description: '', active: true, notes: '' };

export default function Plans() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const canManage = user?.role === 'owner' || user?.role === 'admin';

  const load = async () => {
    try { setPlans(await db.entities.MembershipPlan.list('-created_date', 200)); }
    catch (e) { toast({ title: 'Load failed', variant: 'destructive' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...EMPTY, ...p }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim() || !form.duration_days || form.standard_fee == null) {
      toast({ title: 'Name, duration and fee are required', variant: 'destructive' });
      return;
    }
    try {
      if (editing) {
        await db.entities.MembershipPlan.update(editing.id, form);
        await logAudit({ action: 'plan.edit', entity: 'MembershipPlan', entity_id: editing.id, new_value: form, reason: 'Plan edit' });
        toast({ title: 'Plan updated' });
      } else {
        const p = await db.entities.MembershipPlan.create(form);
        await logAudit({ action: 'plan.create', entity: 'MembershipPlan', entity_id: p.id, new_value: form, reason: 'Plan created' });
        toast({ title: 'Plan created' });
      }
      setOpen(false);
      load();
    } catch (e) { toast({ title: 'Save failed', description: e.message, variant: 'destructive' }); }
  };

  const toggle = async (p) => {
    await db.entities.MembershipPlan.update(p.id, { active: !p.active });
    load();
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Membership Plans</h1>
          <p className="text-sm text-muted-foreground">{plans.length} plans configured</p>
        </div>
        {canManage && <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New Plan</Button>}
      </div>

      {plans.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="glass-card flex items-center gap-3 rounded-2xl p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Layers className="h-5 w-5" /></div>
            <div><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total Plans</p><p className="font-heading text-lg font-bold text-foreground tnum">{plans.length}</p></div>
          </div>
          <div className="glass-card flex items-center gap-3 rounded-2xl p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"><BadgeCheck className="h-5 w-5" /></div>
            <div><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Active</p><p className="font-heading text-lg font-bold text-foreground tnum">{plans.filter((p) => p.active).length}</p></div>
          </div>
          <div className="glass-card flex items-center gap-3 rounded-2xl p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400"><IndianRupee className="h-5 w-5" /></div>
            <div><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Avg Fee</p><p className="font-heading text-lg font-bold text-foreground tnum">{formatCurrency(Math.round(plans.reduce((s, p) => s + Number(p.standard_fee || 0), 0) / plans.length))}</p></div>
          </div>
          <div className="glass-card flex items-center gap-3 rounded-2xl p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400"><IndianRupee className="h-5 w-5" /></div>
            <div><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Cheapest</p><p className="font-heading text-lg font-bold text-foreground tnum">{formatCurrency(Math.min(...plans.map((p) => Number(p.standard_fee || 0))))}</p></div>
          </div>
        </div>
      )}

      {plans.length === 0 ? (
        <EmptyState icon={IdCard} title="No membership plans yet" description="Create your first plan to start enrolling members."
          action={canManage ? <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Create plan</Button> : undefined} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              canManage={canManage}
              onEdit={() => openEdit(p)}
              onToggle={() => toggle(p)}
            />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit plan' : 'New membership plan'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Plan name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Monthly, Quarterly" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Duration (days)</Label>
                <Input type="number" value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Standard fee (₹)</Label>
                <Input type="number" value={form.standard_fee} onChange={(e) => setForm({ ...form, standard_fee: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Internal notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(c) => setForm({ ...form, active: c })} />
              <Label className="text-sm">Active (available for new memberships)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Save changes' : 'Create plan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}