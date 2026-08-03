import React from 'react';
import { CalendarClock, ShieldCheck } from 'lucide-react';
import MemberAvatar from './MemberAvatar';
import StatusBadge from './StatusBadge';
import { formatDate, daysRemaining } from '@/lib/gym';

// QR is generated from the member's OPAQUE token only — no personal data is embedded.
function qrImageUrl(token) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(token)}`;
}

export default function DigitalMemberCard({ member, membership, status, settings }) {
  if (!member) return null;
  const gym = settings?.gym_name || 'DOYEN THE GYM';
  const days = membership ? daysRemaining(membership.end_date) : null;

  return (
    <div className="relative overflow-hidden rounded-3xl p-5 text-primary-foreground shadow-xl sm:p-6">
      <div className="absolute inset-0 -z-10 grad-brand opacity-95" />
      <div className="absolute inset-0 -z-10 grid-overlay opacity-20" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/85">{gym}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/60">Digital Membership Pass</p>
        </div>
        <StatusBadge status={status} className="bg-white/15 text-white ring-white/30" />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <MemberAvatar member={member} size="lg" className="ring-white/40" />
        <div className="min-w-0">
          <p className="truncate font-heading text-xl font-bold">{member.full_name}</p>
          <p className="text-sm text-white/70">{member.member_id}</p>
        </div>
        {member.qr_token && (
          <img
            src={qrImageUrl(member.qr_token)}
            alt="QR code"
            className="ml-auto hidden h-20 w-20 rounded-xl bg-white p-1.5 sm:block"
          />
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/20 pt-4 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/60">Plan</p>
          <p className="font-semibold">{membership?.plan_name || 'No active plan'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/60">Valid Until</p>
          <p className="flex items-center gap-1.5 font-semibold">
            <CalendarClock className="h-3.5 w-3.5" />
            {membership ? formatDate(membership.end_date) : '—'}
          </p>
        </div>
      </div>

      {membership && (
        <p className="mt-2 text-xs text-white/70">
          {days !== null && days >= 0 ? `${days} days remaining` : 'Membership expired'}
        </p>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-[10px] text-white/60">
        <ShieldCheck className="h-3 w-3" /> Scan at reception to check in · Non-transferable
      </p>
    </div>
  );
}