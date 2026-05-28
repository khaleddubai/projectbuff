'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-aegis-500 hover:bg-aegis-400 text-surface-950 shadow-lg shadow-aegis-500/20 hover:shadow-aegis-400/30 active:scale-[0.98]',
  secondary:
    'bg-surface-800 hover:bg-surface-700 text-surface-200 border border-surface-700 hover:border-surface-600 active:scale-[0.98]',
  ghost:
    'text-surface-400 hover:text-surface-200 hover:bg-surface-800/80 active:scale-[0.98]',
  danger:
    'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 hover:shadow-rose-500/30 active:scale-[0.98]',
  success:
    'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30 active:scale-[0.98]',
  warning:
    'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20 hover:shadow-amber-500/30 active:scale-[0.98]',
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs rounded-lg gap-1.5',
  sm: 'px-3 py-1.5 text-sm rounded-xl gap-1.5',
  md: 'px-4 py-2 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 text-base rounded-2xl gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      loading = false,
      icon,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aegis-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950',
        variantStyles[variant],
        sizeStyles[size],
        (disabled || loading) && 'opacity-50 cursor-not-allowed pointer-events-none',
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : icon}
      {children && <span>{children}</span>}
    </button>
  )
);

Button.displayName = 'Button';
