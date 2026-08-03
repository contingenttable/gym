import React from 'react';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Image } from '@/components/ui/image';

export default function MemberAvatar({ member, size = 'md', className }) {
  const sizes = {
    sm: 'h-9 w-9',
    md: 'h-11 w-11',
    lg: 'h-16 w-16',
    xl: 'h-24 w-24',
  };
  const initials = (member?.full_name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (member?.profile_photo) {
    return (
      <div className={cn('overflow-hidden rounded-full ring-2 ring-border', sizes[size], className)}>
        <Image src={member.profile_photo} alt={member.full_name} fittingType="fill" className="h-full w-full" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-semibold ring-2 ring-border',
        sizes[size],
        className
      )}
    >
      {size === 'sm' ? <User className="h-4 w-4" /> : initials || <User className="h-5 w-5" />}
    </div>
  );
}