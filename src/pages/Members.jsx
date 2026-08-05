﻿import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';

import { Search, UserPlus, Users, RefreshCw, X, ArrowRight } from 'lucide-react';
import MemberAvatar from '@/components/gym/MemberAvatar';
import StatusBadge from '@/components/gym/StatusBadge';
import EmptyState from '@/components/gym/EmptyState';
import BulkRenewDialog from '@/components/gym/BulkRenewDialog';
import WakingUp from '@/components/gym/WakingUp';
import { cache, useFetch } from '@/lib/dataCache';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { deriveStatus, formatDate, can, computeBalance } from '@/lib/gym';
import { useAuth } from '@/lib/AuthContext';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const STATUS_FILTERS = [
  { value: 'all', label: 'All Members' },
  { value: 'active', label: 'Active' },
  { value: 'expiring_soon', label: 'Expiring Soon' },
  { value: 'expired', label: 'Expired' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'dues', label: 'Pending Dues' },
];

export default function Members() {
  const { settings } = useOutletContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: membersData, loading } = useFetch('members', async () => {
    const [m, ms, pl, pays] = await Promise.all([
      db.entities.Member.list('-created_date', 1000),
      db.entities.Membership.list('-created_date', 1000),
      db.entities.MembershipPlan.list('-created_date', 200),
      db.entities.Payment.list('-created_date', 1000),
    ]);
    return { members: m, memberships: ms, plans: pl, payments: pays };
  });
  const members     = membersData?.members     || [];
  const memberships = membersData?.memberships || [];
  const plans       = membersData?.plans       || [];
  const payments    = membersData?.payments    || [];

  const latestMembershipByMember = useMemo(() => {
    const map = {};
    for (const m of memberships) {
      const cur = map[m.member_id];
      if (!cur || new Date(m.end_date) > new Date(cur.end_date)) map[m.member_id] = m;
    }
    return map;
  }, [memberships]);

  const paymentsByMember = useMemo(() => {
    const map = {};
    for (const p of payments) {
      if (p.status === 'voided') continue;
      (map[p.member_id] ||= []).push(p);
    }
    return map;
  }, [payments]);

  const searchFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => m.status !== 'archived')
      .filter((m) => !q ||
        (m.full_name || '').toLowerCase().includes(q) ||
        (m.member_id || '').toLowerCase().includes(q) ||
        (m.mobile || '').includes(q));
  }, [members, query]);

  const counts = useMemo(() => {
    const warningDays = settings?.expiry_warning_days ?? 7;
    const c = { all: searchFiltered.length, active: 0, expiring_soon: 0, expired: 0, frozen: 0, dues: 0 };
    for (const m of searchFiltered) {
      const mem = latestMembershipByMember[m.id];
      const s = mem ? deriveStatus(mem, warningDays) : 'expired';
      c[s] = (c[s] || 0) + 1;
      if (computeBalance(mem, paymentsByMember[m.id] || []) > 0) c.dues += 1;
    }
    return c;
  }, [searchFiltered, latestMembershipByMember, settings, paymentsByMember]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return searchFiltered;
    if (statusFilter === 'dues') {
      return searchFiltered.filter((m) => computeBalance(latestMembershipByMember[m.id], paymentsByMember[m.id] || []) > 0);
    }
    const warningDays = settings?.expiry_warning_days ?? 7;
    return searchFiltered.filter((m) => {
      const mem = latestMembershipByMember[m.id];
      if (!mem) return statusFilter === 'expired';
      return deriveStatus(mem, warningDays) === statusFilter;
    });
  }, [searchFiltered, statusFilter, latestMembershipByMember, settings, paymentsByMember]);

  const selectedIds = filtered.filter((m) => selected[m.id]).map((m) => m.id);
  const selectedCount = selectedIds.length;
  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length;
  const toggle = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const toggleAll = () => {
    if (allSelected) {
      setSelected((s) => {
        const next = { ...s };
        for (const m of filtered) next[m.id] = false;
        return next;
      });
    } else {
      setSelected((s) => ({ ...s, ...Object.fromEntries(filtered.map((m) => [m.id, true])) }));
    }
  };
  const clearSelection = () => setSelected({});
  const selectedMembers = filtered.filter((m) => selected[m.id]);

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
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">Members</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {members.length} members</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, ID or mobile…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 hover:-translate-y-px',
                  active
                    ? 'btn-primary-gen border-transparent text-primary-foreground shadow-sm'
                    : 'border-border bg-card/60 text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                {f.label}
                <span className={cn('rounded-full px-1.5 text-[10px] font-bold', active ? 'bg-white/20' : 'bg-muted text-muted-foreground')}>
                  {counts[f.value] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
          <span className="text-sm font-semibold text-foreground">{selectedCount} selected</span>
          {can(user, 'membership.renew') && (
            <Button size="sm" className="rounded-xl" onClick={() => setBulkOpen(true)}>
              <RefreshCw className="h-4 w-4" /> Bulk Renew
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            <X className="h-4 w-4" /> Clear
          </Button>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={members.length === 0 ? 'No members yet' : 'No members match your search'}
          description={members.length === 0 ? 'Register your first member to get started.' : 'Try a different name, ID or status.'}
          action={can(user, 'member.create') ? (
            <Button asChild className="rounded-xl">
              <Link to="/members/new"><UserPlus className="h-4 w-4" /> Add First Member</Link>
            </Button>
          ) : undefined}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border/60 bg-card md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="w-10 px-5 py-3"><Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" /></th>
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Member ID</th>
                  <th className="px-5 py-3">Mobile</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Expires</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((m) => {
                  const mem = latestMembershipByMember[m.id];
                  const status = mem ? deriveStatus(mem, settings?.expiry_warning_days ?? 7) : 'expired';
                  return (
                    <tr key={m.id} onClick={() => navigate(`/members/${m.id}`)} className={cn('cursor-pointer transition-colors', selected[m.id] ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/40')}>
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}><Checkbox checked={!!selected[m.id]} onCheckedChange={() => toggle(m.id)} aria-label={`Select ${m.full_name}`} /></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <MemberAvatar member={m} size="sm" />
                          <span className="font-semibold text-foreground">{m.full_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{m.member_id}</td>
                      <td className="px-5 py-3 text-muted-foreground">{m.mobile}</td>
                      <td className="px-5 py-3 text-muted-foreground">{mem?.plan_name || '—'}</td>
                      <td className="px-5 py-3 text-muted-foreground">{mem ? formatDate(mem.end_date) : '—'}</td>
                      <td className="px-5 py-3"><StatusBadge status={status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2.5 md:hidden">
            {filtered.map((m) => {
              const mem = latestMembershipByMember[m.id];
              const status = mem ? deriveStatus(mem, settings?.expiry_warning_days ?? 7) : 'expired';
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3.5">
                  <Checkbox checked={!!selected[m.id]} onCheckedChange={() => toggle(m.id)} aria-label={`Select ${m.full_name}`} />
                  <Link to={`/members/${m.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <MemberAvatar member={m} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{m.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.member_id} · {m.mobile}</p>
                      <p className="truncate text-xs text-muted-foreground">{mem?.plan_name || 'No plan'} · {mem ? formatDate(mem.end_date) : '—'}</p>
                      <div className="mt-1.5"><StatusBadge status={status} /></div>
                    </div>
                  </Link>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              );
            })}
          </div>
        </>
      )}

      <BulkRenewDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        selectedMembers={selectedMembers}
        latestMembershipByMember={latestMembershipByMember}
        plans={plans}
        onDone={() => {
          clearSelection();
          (async () => {
            try {
              const ms = await db.entities.Membership.list('-created_date', 1000);
              setMemberships(ms);
            } catch (e) { console.error(e); }
          })();
        }}
      />
    </div>
  );
}