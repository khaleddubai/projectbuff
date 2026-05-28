'use client';

import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from './Button';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  removable?: boolean;
  onRemove?: () => void;
}

const variantStyles = {
  default: 'bg-surface-800 text-surface-300 border-surface-700',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  info: 'bg-aegis-500/10 text-aegis-400 border-aegis-500/20',
};

export function Badge({
  variant = 'default',
  size = 'sm',
  removable,
  onRemove,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium border rounded-full',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
      {removable && onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 hover:text-surface-200 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
