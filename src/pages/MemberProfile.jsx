const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link, useOutletContext } from 'react-router-dom';

import {
  ArrowLeft, Edit, RefreshCw, IndianRupee, QrCode, Snowflake, Play, ArrowUpDown,
  CalendarCheck, Clock, Wallet, TrendingUp, History, User, AlertTriangle, Printer, Ban, CheckCircle2,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import MemberAvatar from '@/components/gym/MemberAvatar';
import StatusBadge from '@/components/gym/StatusBadge';
import EmptyState from '@/components/gym/EmptyState';
import RenewDialog from '@/components/gym/RenewDialog';
import RecordPaymentDialog from '@/components/gym/RecordPaymentDialog';
import MemberQrCard from '@/components/gym/MemberQrCard';
import DigitalMemberCard from '@/components/gym/DigitalMemberCard';
import ConfirmDialog from '@/components/gym/ConfirmDialog';
import {
  deriveStatus, formatDate, formatDateTime, formatCurrency, daysRemaining,
  computeBalance, todayISO, addDays, can, logAudit, PAYMENT_MODE_LABEL,
} from '@/lib/gym';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

const ACTIVITY_META = {
  'member.create': { label: 'Member added', icon: User },
  'member.update': { label: 'Profile updated', icon: Edit },
  'attendance.create': { label: 'Check-in', icon: CalendarCheck },
  'membership.create': { label: 'Membership created', icon: RefreshCw },
  'membership.renew': { label: 'Membership renewed', icon: RefreshCw },
  'membership.freeze': { label: 'Membership frozen', icon: Snowflake },
  'membership.unfreeze': { label: 'Membership reactivated', icon: Play },
  'payment.create': { label: 'Payment recorded', icon: IndianRupee },
  'payment.correct': { label: 'Payment corrected', icon: Ban },
};

export default function MemberProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { settings } = useOutletContext();
  const symbol = settings?.currency_symbol || '₹';

  const [member, setMember] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [payments, setPayments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewMode, setRenewMode] = useState('renew');
  const [payOpen, setPayOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [voidPayment, setVoidPayment] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [dupWarning, setDupWarning] = useState(null);
  const [audit, setAudit] = useState([]);

  const loadAll = async () => {
    const [m, ms, pays, att, pl, logs] = await Promise.all([
      db.entities.Member.get(id),
      db.entities.Membership.list('-created_date', 200),
      db.entities.Payment.list('-created_date', 500),
      db.entities.Attendance.list('-created_date', 500),
      db.entities.MembershipPlan.list('-created_date', 100),
      db.entities.AuditLog.list('-created_date', 500),
    ]);
    setMember(m);
    const memberMs = ms.filter((x) => x.member_id === id).sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
    const memberPays = pays.filter((x) => x.member_id === id).sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
    setMemberships(memberMs);
    setPayments(memberPays);
    setAttendance(att.filter((x) => x.member_id === id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    setPlans(pl);
    const msIds = new Set(memberMs.map((x) => x.id));
    const payIds = new Set(memberPays.map((x) => x.id));
    setAudit(logs.filter((x) => x.entity_id === id || msIds.has(x.entity_id) || payIds.has(x.entity_id)));
  };

  useEffect(() => {
    (async () => {
      try { await loadAll(); }
      catch (e) { toast({ title: 'Member not found', variant: 'destructive' }); navigate('/members'); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const currentMembership = memberships[0];
  const status = currentMembership ? deriveStatus(currentMembership, settings?.expiry_warning_days ?? 7) : 'expired';
  const balance = currentMembership ? computeBalance(currentMembership, payments) : 0;
  const totalVisits = attendance.length;
  const lastAttendance = attendance[0];

  const checkIn = async (method) => {
    const threshold = settings?.attendance_duplicate_threshold ?? 240;
    if (attendance.length) {
      const last = new Date(attendance[0].timestamp);
      const mins = (Date.now() - last.getTime()) / 60000;
      if (mins < threshold) {
        setDupWarning({ last: attendance[0], method });
        return;
      }
    }
    await doCheckIn(method);
  };

  const doCheckIn = async (method) => {
    try {
      const now = new Date();
      await db.entities.Attendance.create({
        member_id: id,
        member_name: member.full_name,
        timestamp: now.toISOString(),
        date: now.toISOString().slice(0, 10),
        method,
        correction_status: 'none',
      });
      await logAudit({ action: 'attendance.create', entity: 'Attendance', entity_id: id, reason: `Check-in via ${method}` });
      toast({ title: 'Checked in', description: member.full_name });
      await loadAll();
    } catch (e) {
      toast({ title: 'Check-in failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleFreeze = async (reason, expectedUnfreeze) => {
    try {
      await db.entities.Membership.update(currentMembership.id, { status: 'frozen' });
      await db.entities.MembershipEvent.create({
        membership_id: currentMembership.id,
        member_id: id,
        type: 'freeze',
        start_date: todayISO(),
        expected_unfreeze_date: expectedUnfreeze || '',
        reason,
      });
      await logAudit({ action: 'membership.freeze', entity: 'Membership', entity_id: currentMembership.id, reason });
      toast({ title: 'Membership frozen' });
      setFreezeOpen(false);
      await loadAll();
    } catch (e) { toast({ title: 'Freeze failed', description: e.message, variant: 'destructive' }); }
  };

  const handleUnfreeze = async () => {
    try {
      // find latest freeze event to compute extension
      const events = await db.entities.MembershipEvent.filter({ membership_id: currentMembership.id }, '-created_date', 50);
      const freezeEv = events.find((e) => e.type === 'freeze');
      let newEnd = currentMembership.end_date;
      if (freezeEv && freezeEv.start_date) {
        const frozenDays = Math.max(0, daysRemaining(freezeEv.start_date) * -1);
        // frozenDays approx = today - freezeStart
        const fd = Math.round((Date.now() - new Date(freezeEv.start_date).getTime()) / (1000 * 60 * 60 * 24));
        newEnd = addDays(currentMembership.end_date, Math.max(0, fd));
      }
      await db.entities.Membership.update(currentMembership.id, { status: 'active', end_date: newEnd });
      await db.entities.MembershipEvent.create({
        membership_id: currentMembership.id,
        member_id: id,
        type: 'unfreeze',
        reason: `Extended to ${formatDate(newEnd)}`,
      });
      await logAudit({ action: 'membership.unfreeze', entity: 'Membership', entity_id: currentMembership.id, reason: `New expiry ${formatDate(newEnd)}` });
      toast({ title: 'Membership reactivated', description: `New expiry ${formatDate(newEnd)}` });
      await loadAll();
    } catch (e) { toast({ title: 'Unfreeze failed', description: e.message, variant: 'destructive' }); }
  };

  const handleVoid = async () => {
    try {
      await db.entities.Payment.update(voidPayment.id, { status: 'voided' });
      await db.entities.PaymentAdjustment.create({
        payment_id: voidPayment.id,
        original_amount: voidPayment.amount,
        corrected_amount: 0,
        reason: voidReason || 'Voided',
      });
      await logAudit({ action: 'payment.correct', entity: 'Payment', entity_id: voidPayment.id, previous_value: { amount: voidPayment.amount }, new_value: { status: 'voided' }, reason: voidReason });
      toast({ title: 'Payment voided' });
      setVoidPayment(null); setVoidReason('');
      await loadAll();
    } catch (e) { toast({ title: 'Failed', description: e.message, variant: 'destructive' }); }
  };

  const printReceipt = (p) => {
    const w = window.open('', '_blank', 'width=380,height=620');
    w.document.write(`
      <html><head><title>Receipt ${p.receipt_number}</title><style>
        body{font-family:ui-sans-serif,system-ui,sans-serif;padding:24px;color:#0f172a}
        h1{font-size:18px;margin:0}.muted{color:#64748b;font-size:12px}
        .row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px dashed #e2e8f0}
        .total{font-weight:700;font-size:16px}
        .center{text-align:center;margin:12px 0}
      </style></head><body>
        <div class="center"><h1>${settings?.gym_name || 'FitCore Gym'}</h1><div class="muted">${settings?.address || ''}</div></div>
        <div class="row"><span>Receipt</span><b>${p.receipt_number}</b></div>
        <div class="row"><span>Member</span><span>${member.full_name}</span></div>
        <div class="row"><span>Member ID</span><span>${member.member_id}</span></div>
        <div class="row"><span>Date</span><span>${formatDate(p.payment_date)}</span></div>
        <div class="row"><span>Mode</span><span>${PAYMENT_MODE_LABEL[p.mode]}</span></div>
        ${p.reference_number ? `<div class="row"><span>Ref</span><span>${p.reference_number}</span></div>` : ''}
        <div class="row total"><span>Amount</span><span>${formatCurrency(p.amount, symbol)}</span></div>
        <div class="row"><span>Balance</span><span>${formatCurrency(balance, symbol)}</span></div>
        <div class="center muted">Thank you for your payment!</div>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    );
  }

  if (!member) return null;

  const isFrozen = status === 'frozen';

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/members')} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Members
      </button>

      {/* Header */}
      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <MemberAvatar member={member} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-bold text-foreground">{member.full_name}</h1>
              <StatusBadge status={status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{member.member_id} · {member.mobile}</p>
            {member.email && <p className="text-sm text-muted-foreground">{member.email}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {can(user, 'attendance.create') && (
              <Button onClick={() => checkIn('search')} className="bg-emerald-600 hover:bg-emerald-700">
                <CalendarCheck className="mr-1.5 h-4 w-4" /> Check In
              </Button>
            )}
            {can(user, 'membership.renew') && (
              <Button variant="outline" onClick={() => { setRenewMode('renew'); setRenewOpen(true); }}><RefreshCw className="mr-1.5 h-4 w-4" /> Renew</Button>
            )}
            {can(user, 'membership.renew') && currentMembership && (
              <Button variant="outline" onClick={() => { setRenewMode('switch'); setRenewOpen(true); }}><ArrowUpDown className="mr-1.5 h-4 w-4" /> Switch Plan</Button>
            )}
            {can(user, 'payment.create') && (
              <Button variant="outline" onClick={() => setPayOpen(true)}><IndianRupee className="mr-1.5 h-4 w-4" /> Payment</Button>
            )}
            <Button variant="outline" onClick={() => setQrOpen(true)}><QrCode className="mr-1.5 h-4 w-4" /> QR Card</Button>
            {can(user, 'member.edit') && (
              <Button variant="outline" onClick={() => navigate(`/members/${member.id}/edit`)}><Edit className="mr-1.5 h-4 w-4" /> Edit</Button>
            )}
          </div>
        </div>
      </div>

      {/* Current membership summary */}
      {currentMembership ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard icon={User} label="Current Plan" value={currentMembership.plan_name} />
          <SummaryCard icon={Clock} label="Expires" value={formatDate(currentMembership.end_date)} sub={`${daysRemaining(currentMembership.end_date)} days left`} />
          <SummaryCard icon={Wallet} label="Outstanding" value={formatCurrency(balance, symbol)} />
          <SummaryCard icon={TrendingUp} label="Total Visits" value={String(totalVisits)} sub={lastAttendance ? `Last: ${formatDate(lastAttendance.date)}` : ''} />
        </div>
      ) : (
        <EmptyState icon={User} title="No membership yet" description="Assign a membership plan to activate this member."
          action={can(user, 'membership.renew') ? <Button onClick={() => setRenewOpen(true)}><RefreshCw className="mr-1.5 h-4 w-4" /> Add Membership</Button> : undefined} />
      )}

      {isFrozen && can(user, 'membership.freeze') && (
        <div className="flex items-center justify-between rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4">
          <div className="flex items-center gap-2 text-sm">
            <Snowflake className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            <span className="font-semibold text-sky-700 dark:text-sky-300">Membership is frozen</span>
          </div>
          <Button variant="outline" onClick={handleUnfreeze}><Play className="mr-1.5 h-4 w-4" /> Unfreeze</Button>
        </div>
      )}

      {!isFrozen && currentMembership && can(user, 'membership.freeze') && (
        <div className="flex justify-end">
          <Button variant="ghost" className="text-muted-foreground" onClick={() => setFreezeOpen(true)}>
            <Snowflake className="mr-1.5 h-4 w-4" /> Freeze membership
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5 max-w-xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="memberships">Memberships</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <DigitalMemberCard member={member} membership={currentMembership} status={status} settings={settings} />
          <div className="glass-card grid gap-x-6 gap-y-3 rounded-2xl p-5 sm:grid-cols-2 sm:p-6">
            <Detail label="Member ID" value={member.member_id} />
            <Detail label="Mobile" value={member.mobile} />
            <Detail label="Alt mobile" value={member.alt_mobile || '—'} />
            <Detail label="Email" value={member.email || '—'} />
            <Detail label="Date of birth" value={member.dob ? formatDate(member.dob) : '—'} />
            <Detail label="Gender" value={member.gender || '—'} />
            <Detail label="Joining date" value={member.joining_date ? formatDate(member.joining_date) : '—'} />
            <Detail label="Emergency contact" value={member.emergency_contact || '—'} />
            {member.address && <Detail label="Address" value={member.address} full />}
            {member.notes && <Detail label="Notes" value={member.notes} full />}
          </div>
        </TabsContent>

        <TabsContent value="memberships" className="mt-4">
          {memberships.length === 0 ? (
            <EmptyState icon={History} title="No membership history" />
          ) : (
            <div className="space-y-2.5">
              {memberships.map((m) => {
                const ms = deriveStatus(m, settings?.expiry_warning_days ?? 7);
                const bal = computeBalance(m, payments);
                return (
                  <div key={m.id} className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{m.plan_name}</p>
                        <StatusBadge status={ms} />
                      </div>
                      <p className="text-sm text-muted-foreground">{formatDate(m.start_date)} → {formatDate(m.end_date)} · Fee {formatCurrency(m.fee, symbol)}{m.discount > 0 && <span className="text-emerald-600 dark:text-emerald-400"> · Disc {formatCurrency(m.discount, symbol)}</span>}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(bal, symbol)}</p>
                      <p className="text-xs text-muted-foreground">balance</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          {attendance.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No attendance recorded" />
          ) : (
            <div className="glass-card overflow-hidden rounded-2xl">
              <div className="divide-y divide-border/60">
                {attendance.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-foreground">{formatDate(a.date)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className="text-xs">{a.method === 'qr' ? 'QR scan' : 'Search'}</span>
                      <span className="text-xs">{formatDateTime(a.timestamp).split(',')[1]?.trim()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          {payments.length === 0 ? (
            <EmptyState icon={IndianRupee} title="No payments recorded" />
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className={`glass-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 ${p.status === 'voided' ? 'opacity-50' : ''}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{formatCurrency(p.amount, symbol)}</p>
                      {p.status === 'voided' && <StatusBadge status="cancelled" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{p.receipt_number} · {PAYMENT_MODE_LABEL[p.mode]} · {formatDate(p.payment_date)}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => printReceipt(p)}><Printer className="h-4 w-4" /></Button>
                    {p.status !== 'voided' && can(user, 'payment.correct') && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setVoidPayment(p)}><Ban className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          {audit.length === 0 ? (
            <EmptyState icon={History} title="No activity yet" description="Membership, attendance and payment events will appear here." />
          ) : (
            <div className="glass-card overflow-hidden rounded-2xl p-4 sm:p-5">
              <ol className="relative space-y-4 border-l border-border/60 pl-5">
                {audit.map((a) => {
                  const meta = ACTIVITY_META[a.action] || { label: a.action, icon: History };
                  const Icon = meta.icon;
                  return (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[1.45rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-card ring-1 ring-border/60">
                        <Icon className="h-3 w-3 text-primary" />
                      </span>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                        <span className="text-xs text-muted-foreground">{formatDateTime(a.created_date)}</span>
                      </div>
                      {a.reason && <p className="mt-0.5 text-xs text-muted-foreground">{a.reason}</p>}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <RenewDialog open={renewOpen} onOpenChange={setRenewOpen} member={member} currentMembership={currentMembership} plans={plans} onSaved={loadAll} mode={renewMode} />
      <RecordPaymentDialog open={payOpen} onOpenChange={setPayOpen} member={member} memberships={memberships} existingPayments={payments} onSaved={loadAll} />
      <MemberQrCard open={qrOpen} onOpenChange={setQrOpen} member={member} />
      <Dialog open={!!voidPayment} onOpenChange={(o) => { if (!o) { setVoidPayment(null); setVoidReason(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Ban className="h-5 w-5 text-destructive" /> Void payment?</DialogTitle>
            <DialogDescription>
              Receipt {voidPayment?.receipt_number} · {formatCurrency(voidPayment?.amount || 0, symbol)}. A reason is required for the audit log.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} rows={3} placeholder="e.g. Duplicate entry, wrong amount" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setVoidPayment(null); setVoidReason(''); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleVoid} disabled={!voidReason.trim()}>Void payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Freeze dialog */}
      <Dialog open={freezeOpen} onOpenChange={setFreezeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Snowflake className="h-5 w-5 text-sky-500" /> Freeze membership</DialogTitle>
            <DialogDescription>The membership will be paused and can be reactivated later.</DialogDescription>
          </DialogHeader>
          <FreezeForm onCancel={() => setFreezeOpen(false)} onSubmit={handleFreeze} />
        </DialogContent>
      </Dialog>

      {/* Duplicate check-in warning */}
      <Dialog open={!!dupWarning} onOpenChange={(o) => !o && setDupWarning(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Already checked in</DialogTitle>
            <DialogDescription>
              {member.full_name} checked in at {dupWarning ? formatDateTime(dupWarning.last.timestamp) : ''}. Record another check-in anyway?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDupWarning(null)}>No</Button>
            <Button onClick={() => { const m = dupWarning.method; setDupWarning(null); doCheckIn(m); }}>Yes, check in</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <p className="mt-1 font-heading text-lg font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Detail({ label, value, full }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function FreezeForm({ onCancel, onSubmit }) {
  const [reason, setReason] = useState('');
  const [expected, setExpected] = useState('');
  return (
    <div className="space-y-3 py-1">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Reason</Label>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Travel, medical" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Expected unfreeze date (optional)</Label>
        <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(reason, expected)} disabled={!reason.trim()}>Confirm freeze</Button>
      </div>
    </div>
  );
}