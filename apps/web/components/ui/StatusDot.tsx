'use client';

import { cn, getStatusDot } from '@/lib/utils';

interface StatusDotProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-3 h-3',
};

export function StatusDot({ status, label, size = 'md', className }: StatusDotProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        className={cn(
          'rounded-full shrink-0',
          sizeStyles[size],
          getStatusDot(status)
        )}
      />
      {label && (
        <span className="text-xs font-medium text-surface-400">{label}</span>
      )}
    </span>
  );
}
