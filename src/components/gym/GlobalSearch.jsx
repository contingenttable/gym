import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Search, UserPlus, CheckCircle2, IndianRupee, RefreshCw, CornerDownLeft } from 'lucide-react';
import { formatDate, formatCurrency, deriveStatus } from '@/lib/gym';
import MemberAvatar from './MemberAvatar';
import StatusBadge from './StatusBadge';
import { cn } from '@/lib/utils';

export default function GlobalSearch({ open, onOpenChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const all = await db.entities.Member.list('-created_date', 500);
        const filtered = all.filter(
          (m) =>
            (m.full_name || '').toLowerCase().includes(q) ||
            (m.member_id || '').toLowerCase().includes(q) ||
            (m.mobile || '').includes(q)
        );
        if (!cancelled) {
          setResults(filtered.slice(0, 8));
          setActiveIndex(0);
        }
      } catch (e) {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const go = (member) => {
    onOpenChange(false);
    navigate(`/members/${member.id}`);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      go(results[activeIndex]);
    } else if (e.key === 'Escape') {
      onOpenChange(false);
    }
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh] transition',
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      )}
      onClick={() => onOpenChange(false)}
    >
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" />
      <div
        className="glass-card relative z-10 w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border/60 px-4">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search members by name, ID or mobile…"
            className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">ESC</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto scrollbar-thin">
          {loading && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">Searching…</div>
          )}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">No members found for “{query}”.</p>
              <button
                onClick={() => { onOpenChange(false); navigate('/members/new'); }}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
              >
                <UserPlus className="h-4 w-4" /> Register new member
              </button>
            </div>
          )}
          {!loading && query.trim().length < 2 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search members.
            </div>
          )}
          {results.length > 0 && (
            <ul className="p-2">
              {results.map((m, i) => (
                <li key={m.id}>
                  <button
                    onClick={() => go(m)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                      i === activeIndex ? 'bg-primary/10' : 'hover:bg-muted/60'
                    )}
                  >
                    <MemberAvatar member={m} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{m.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.member_id} · {m.mobile}
                      </p>
                    </div>
                    <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}