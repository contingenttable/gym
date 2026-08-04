import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { Settings as SettingsIcon, Save, Building2, Hash, Timer, ReceiptText, Globe, ImagePlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { logAudit, getSettings } from '@/lib/gym';
import { useToast } from '@/components/ui/use-toast';

export default function Settings() {
  const { toast } = useToast();
  const { setSettings } = useOutletContext();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then(setForm);
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      set('logo', file_url);
    } catch (err) { toast({ title: 'Upload failed', variant: 'destructive' }); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = form.id
        ? await db.entities.Setting.update(form.id, form)
        : await db.entities.Setting.create(form);
      await logAudit({ action: 'settings.update', entity: 'Setting', entity_id: saved.id, new_value: form, reason: 'Settings change' });
      setSettings(saved);
      toast({ title: 'Settings saved' });
    } catch (e) { toast({ title: 'Save failed', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  if (!form) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Gym Settings</h1>
          <p className="text-sm text-muted-foreground">Configure your gym profile and operational defaults</p>
        </div>
      </div>

      {/* Brand Identity */}
      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <SectionHead icon={Building2} title="Brand Identity" desc="Logo, contact and address shown across receipts & check-in portal" />
        <div className="flex items-center gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/30 p-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card">
            {form.logo ? <img src={form.logo} alt="logo" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6 text-muted-foreground" />}
          </div>
          <div className="min-w-0">
            <Label className="text-xs text-muted-foreground">Gym logo</Label>
            <input type="file" accept="image/*" onChange={handleLogo} className="mt-1 block text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground" />
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Gym name"><Input value={form.gym_name || ''} onChange={(e) => set('gym_name', e.target.value)} /></Field>
          <Field label="Phone"><Input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Email"><Input value={form.email || ''} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Address"><Textarea rows={2} value={form.address || ''} onChange={(e) => set('address', e.target.value)} /></Field>
        </div>
      </div>

      {/* ID & Receipt Formatting */}
      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <SectionHead icon={Hash} title="ID & Receipt Formatting" desc="Prefixes and symbols used when generating member IDs and receipts" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Member ID prefix"><Input value={form.member_id_prefix || ''} onChange={(e) => set('member_id_prefix', e.target.value)} /></Field>
          <Field label="Receipt prefix"><Input value={form.receipt_prefix || ''} onChange={(e) => set('receipt_prefix', e.target.value)} /></Field>
          <Field label="Currency symbol"><Input value={form.currency_symbol || ''} onChange={(e) => set('currency_symbol', e.target.value)} /></Field>
          <Field label="Date format"><Input value={form.date_format || ''} onChange={(e) => set('date_format', e.target.value)} placeholder="dd MMM yyyy" /></Field>
          <Field label="Timezone"><Input value={form.timezone || ''} onChange={(e) => set('timezone', e.target.value)} /></Field>
        </div>
        {/* format previews */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <Hash className="h-3 w-3" /> Member ID → {(form.member_id_prefix || 'GYM')}-000001
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-fuchsia-500/10 px-2.5 py-1 text-xs font-semibold text-fuchsia-600 dark:text-fuchsia-400">
            <ReceiptText className="h-3 w-3" /> Receipt → {(form.receipt_prefix || 'RCP')}-000001
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Globe className="h-3 w-3" /> {form.currency_symbol || '₹'}1,500 · {form.date_format || 'dd MMM yyyy'}
          </span>
        </div>
      </div>

      {/* Retention & Attendance */}
      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <SectionHead icon={Timer} title="Retention & Attendance" desc="Automated expiry warnings and check-out thresholds" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Expiry warning (days)" hint="Memberships expiring within this window are flagged">
            <Input type="number" value={form.expiry_warning_days ?? 7} onChange={(e) => set('expiry_warning_days', Number(e.target.value))} />
          </Field>
          <Field label="Auto check-out (minutes)" hint="Open check-ins auto-close after this duration">
            <Input type="number" value={form.attendance_duplicate_threshold ?? 240} onChange={(e) => set('attendance_duplicate_threshold', Number(e.target.value))} />
          </Field>
        </div>
      </div>

      <div className="sticky bottom-3 z-10 flex justify-end">
        <Button onClick={save} disabled={saving} className="min-w-[160px]"><Save className="mr-2 h-4 w-4" /> {saving ? 'Saving…' : 'Save settings'}</Button>
      </div>
    </div>
  );
}

function SectionHead({ icon: Icon, title, desc }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h3 className="font-heading text-sm font-bold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/80">{hint}</p>}
    </div>
  );
}