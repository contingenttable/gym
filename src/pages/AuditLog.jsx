const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useMemo, useState } from 'react';

import { ClipboardList, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import EmptyState from '@/components/gym/EmptyState';
import { formatDateTime } from '@/lib/gym';
import { useAuth } from '@/lib/AuthContext';

export default function AuditLog() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      try { setLogs(await db.entities.AuditLog.list('-created_date', 500)); }
      catch (e) {}
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) =>
      (l.action || '').toLowerCase().includes(q) ||
      (l.entity || '').toLowerCase().includes(q) ||
      (l.reason || '').toLowerCase().includes(q) ||
      (l.entity_id || '').toLowerCase().includes(q)
    );
  }, [logs, query]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground">Immutable record of sensitive actions</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by action, entity, reason…" className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No audit entries" description="Sensitive actions will appear here as they happen." />
      ) : (
        <div className="glass-card overflow-hidden rounded-2xl">
          <div className="divide-y divide-border/60">
            {filtered.map((l) => (
              <div key={l.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{l.action}</span>
                  <span className="text-xs text-muted-foreground">on</span>
                  <span className="text-xs font-medium text-foreground">{l.entity}</span>
                  {l.entity_id && <span className="text-xs text-muted-foreground">· {l.entity_id.slice(-8)}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(l.created_date)}</span>
                </div>
                {l.reason && <p className="mt-1 text-sm text-muted-foreground">{l.reason}</p>}
                {(l.previous_value || l.new_value) && (
                  <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
                    {l.previous_value && <span className="text-rose-500">prev: {l.previous_value.slice(0, 120)}</span>}
                    {l.new_value && <span className="text-emerald-600 dark:text-emerald-400">new: {l.new_value.slice(0, 120)}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}