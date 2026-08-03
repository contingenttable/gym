import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Crown } from 'lucide-react';
import MemberAvatar from '@/components/gym/MemberAvatar';

const MEDALS = [
  'from-amber-300 to-yellow-500',
  'from-slate-300 to-slate-500',
  'from-orange-300 to-amber-700',
];

export default function TopMembersLeaderboard({ attendance, memberMap }) {
  const leaders = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const counts = {};
    for (const a of attendance || []) {
      const d = new Date(a.timestamp || a.date);
      if (d.getMonth() === month && d.getFullYear() === year) {
        counts[a.member_id] = (counts[a.member_id] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([id, count]) => ({ id, count, member: memberMap?.[id] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [attendance, memberMap]);

  const max = leaders[0]?.count || 1;

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl grad-brand text-primary-foreground shadow-sm">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-heading text-base font-bold text-foreground">Top Members</h3>
            <p className="text-xs text-muted-foreground">Most check-ins this month</p>
          </div>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          {new Date().toLocaleDateString('en-IN', { month: 'long' })}
        </span>
      </div>

      {leaders.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No check-ins yet this month.</p>
      ) : (
        <ul className="space-y-2.5">
          {leaders.map((l, i) => {
            const rank = i + 1;
            const pct = Math.max(10, Math.round((l.count / max) * 100));
            return (
              <li key={l.id}>
                <Link to={`/members/${l.id}`} className="block rounded-xl px-2 py-2 hover:bg-muted/60">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                        rank <= 3 ? `bg-gradient-to-br ${MEDALS[rank - 1]}` : 'bg-muted-foreground/60'
                      }`}
                    >
                      {rank <= 3 ? <Crown className="h-3.5 w-3.5" /> : rank}
                    </div>
                    <MemberAvatar member={l.member} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {l.member?.full_name || l.member?.member_id || 'Unknown'}
                      </p>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full grad-brand" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{l.count}</p>
                      <p className="text-[11px] text-muted-foreground">{l.count === 1 ? 'check-in' : 'check-ins'}</p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}