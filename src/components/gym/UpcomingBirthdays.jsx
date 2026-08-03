import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Cake, Sparkles } from 'lucide-react';
import MemberAvatar from '@/components/gym/MemberAvatar';
import EmptyState from '@/components/gym/EmptyState';

const HORIZON_DAYS = 30;

function nextBirthday(dob) {
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
  const days = Math.round((next - today) / 86400000);
  return { next, days };
}

const fmt = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function UpcomingBirthdays({ members }) {
  const { today, upcoming } = useMemo(() => {
    const today = [];
    const upcoming = [];
    for (const m of members || []) {
      if (!m.dob) continue;
      const nb = nextBirthday(m.dob);
      if (!nb) continue;
      if (nb.days === 0) today.push(m);
      else if (nb.days <= HORIZON_DAYS) upcoming.push({ member: m, ...nb });
    }
    upcoming.sort((a, b) => a.days - b.days);
    return { today, upcoming: upcoming.slice(0, 6) };
  }, [members]);

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400">
            <Cake className="h-4 w-4" />
          </div>
          <h3 className="font-heading text-base font-bold text-foreground">Upcoming Birthdays</h3>
        </div>
        <Link to="/members" className="text-xs font-medium text-primary hover:underline">View all</Link>
      </div>

      {today.length > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500/15 to-violet-500/15 px-3 py-2">
          <Sparkles className="h-4 w-4 text-fuchsia-600 dark:text-fuchsia-400" />
          <p className="text-sm font-semibold text-fuchsia-700 dark:text-fuchsia-300">
            {today.length === 1 ? `${today[0].full_name}'s birthday is today!` : `${today.length} birthdays today`}
          </p>
        </div>
      )}

      {today.length === 0 && upcoming.length === 0 ? (
        <EmptyState icon={Cake} title="No birthdays coming up" description="Member dates of birth will appear here within 30 days." />
      ) : (
        <ul className="space-y-1">
          {today.map((m) => (
            <li key={`t-${m.id}`}>
              <Link to={`/members/${m.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60">
                <MemberAvatar member={m} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{m.full_name}</p>
                  <p className="text-xs text-muted-foreground">{m.member_id}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/15 px-2.5 py-1 text-xs font-bold text-fuchsia-600 dark:text-fuchsia-400">
                  <Cake className="h-3 w-3" /> Today
                </span>
              </Link>
            </li>
          ))}
          {upcoming.map(({ member, next, days }) => (
            <li key={member.id}>
              <Link to={`/members/${member.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60">
                <MemberAvatar member={member} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{member.full_name}</p>
                  <p className="text-xs text-muted-foreground">{member.member_id}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-foreground">{fmt(next)}</p>
                  <p className="text-[11px] text-muted-foreground">in {days}d</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}