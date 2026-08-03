const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useMemo, useState } from 'react';

import { Search, UserCheck } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import MemberAvatar from './MemberAvatar';
import StatusBadge from './StatusBadge';
import { deriveStatus } from '@/lib/gym';

export default function MemberPickerDialog({ open, onOpenChange, onPick, title = 'Select a member' }) {
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [m, ms] = await Promise.all([
          db.entities.Member.list('-created_date', 1000),
          db.entities.Membership.list('-created_date', 1000),
        ]);
        setMembers(m);
        setMemberships(ms);
      } catch (e) {}
    })();
  }, [open]);

  const latestByMember = useMemo(() => {
    const map = {};
    for (const m of memberships) {
      const cur = map[m.member_id];
      if (!cur || new Date(m.end_date) > new Date(cur.end_date)) map[m.member_id] = m;
    }
    return map;
  }, [memberships]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return members.slice(0, 12);
    return members.filter((m) =>
      (m.full_name || '').toLowerCase().includes(q) ||
      (m.member_id || '').toLowerCase().includes(q) ||
      (m.mobile || '').includes(q)
    ).slice(0, 20);
  }, [members, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members…" className="pl-9" />
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No members found.</p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((m) => {
                const mem = latestByMember[m.id];
                const st = mem ? deriveStatus(mem, 7) : 'expired';
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => onPick(m)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-muted/60"
                    >
                      <MemberAvatar member={m} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{m.full_name}</p>
                        <p className="text-xs text-muted-foreground">{m.member_id} · {m.mobile}</p>
                      </div>
                      <StatusBadge status={st} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}