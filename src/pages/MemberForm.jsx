import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';

import { ArrowLeft, Save, AlertTriangle, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { nextMemberId, generateQrToken, todayISO, logAudit } from '@/lib/gym';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

export default function MemberForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { settings } = useOutletContext();
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState(null);
  const [form, setForm] = useState({
    full_name: '', mobile: '', alt_mobile: '', email: '',
    dob: '', gender: '', address: '', emergency_contact: '',
    joining_date: todayISO(), notes: '', status: 'active', profile_photo: '',
  });

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const m = await db.entities.Member.get(id);
        setForm({
          full_name: m.full_name || '', mobile: m.mobile || '', alt_mobile: m.alt_mobile || '',
          email: m.email || '', dob: m.dob || '', gender: m.gender || '',
          address: m.address || '', emergency_contact: m.emergency_contact || '',
          joining_date: m.joining_date || todayISO(), notes: m.notes || '',
          status: m.status || 'active', profile_photo: m.profile_photo || '',
        });
      } catch (e) { toast({ title: 'Member not found', variant: 'destructive' }); navigate('/members'); }
      finally { setLoading(false); }
    })();
  }, [id]);

  // Duplicate detection on mobile / email
  useEffect(() => {
    if (!form.mobile || form.mobile.length < 6) { setDuplicate(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const all = await db.entities.Member.list('-created_date', 1000);
        const match = all.find((m) =>
          m.id !== id &&
          ((m.mobile && m.mobile === form.mobile) ||
           (form.email && m.email && m.email.toLowerCase() === form.email.toLowerCase()))
        );
        if (!cancelled) setDuplicate(match || null);
      } catch (e) { if (!cancelled) setDuplicate(null); }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.mobile, form.email, id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      set('profile_photo', file_url);
    } catch (err) { toast({ title: 'Upload failed', variant: 'destructive' }); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.mobile.trim()) {
      toast({ title: 'Name and mobile are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        const original = await db.entities.Member.get(id);
        await db.entities.Member.update(id, { ...form });
        await logAudit({ action: 'member.edit', entity: 'Member', entity_id: id, previous_value: original, new_value: form, reason: 'Profile edit' });
        toast({ title: 'Member updated' });
        navigate(`/members/${id}`);
      } else {
        const memberId = await nextMemberId(settings?.member_id_prefix || 'GYM');
        const created = await db.entities.Member.create({
          ...form,
          member_id: memberId,
          qr_token: generateQrToken(),
        });
        await logAudit({ action: 'member.create', entity: 'Member', entity_id: created.id, new_value: { member_id: memberId, name: form.full_name }, reason: 'New registration' });
        toast({ title: 'Member registered', description: memberId });
        navigate(`/members/${created.id}`);
      }
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <UserPlus className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">{isEdit ? 'Edit Member' : 'Register New Member'}</h1>
          <p className="text-sm text-muted-foreground">{isEdit ? 'Update member details' : 'Only name and mobile are required'}</p>
        </div>
      </div>

      {duplicate && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-amber-700 dark:text-amber-300">Possible duplicate member</p>
            <p className="text-amber-700/80 dark:text-amber-300/80">
              {duplicate.full_name} ({duplicate.member_id}) already exists with this mobile or email.
            </p>
          </div>
          <button onClick={() => navigate(`/members/${duplicate.id}`)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white">
            Open existing
          </button>
        </div>
      )}

      <form onSubmit={submit} className="glass-card space-y-5 rounded-2xl p-5 sm:p-6">
        {/* Photo */}
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted">
            {form.profile_photo ? <img src={form.profile_photo} alt="" className="h-full w-full object-cover" /> : <UserPlus className="h-7 w-7 text-muted-foreground" />}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Profile photo (optional)</Label>
            <input type="file" accept="image/*" onChange={handlePhoto} className="mt-1 block text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="e.g. Rahul Sharma" />
          </Field>
          <Field label="Mobile number" required>
            <Input value={form.mobile} onChange={(e) => set('mobile', e.target.value)} placeholder="10-digit mobile" />
          </Field>
          <Field label="Alternate mobile">
            <Input value={form.alt_mobile} onChange={(e) => set('alt_mobile', e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="optional" />
          </Field>
          <Field label="Date of birth">
            <Input type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} />
          </Field>
          <Field label="Gender">
            <Select value={form.gender || '_'} onValueChange={(v) => set('gender', v === '_' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Prefer not to say" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_">Prefer not to say</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Joining date">
            <Input type="date" value={form.joining_date} onChange={(e) => set('joining_date', e.target.value)} />
          </Field>
          <Field label="Emergency contact">
            <Input value={form.emergency_contact} onChange={(e) => set('emergency_contact', e.target.value)} placeholder="name / number" />
          </Field>
        </div>

        <Field label="Address">
          <Textarea value={form.address} onChange={(e) => set('address', e.target.value)} rows={2} placeholder="optional" />
        </Field>
        <Field label="Notes">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Internal notes" />
        </Field>

        {isEdit && (
          <Field label="Status">
            <Select value={form.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" /> {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Register member'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}