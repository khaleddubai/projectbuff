'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, description, error, icon, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-surface-300"
          >
            {label}
          </label>
        )}
        {description && (
          <p className="text-xs text-surface-500">{description}</p>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full bg-surface-800/80 border rounded-xl px-3.5 py-2.5 text-sm text-surface-200 placeholder:text-surface-500 transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-aegis-400/30 focus:border-aegis-500/50',
              'hover:border-surface-600',
              icon && 'pl-10',
              error
                ? 'border-rose-500/50 focus:ring-rose-400/30'
                : 'border-surface-700',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
            <span>⚠</span> {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
