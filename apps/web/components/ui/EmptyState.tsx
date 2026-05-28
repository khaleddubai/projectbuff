'use client';

import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-6 text-center animate-fade-in',
        className
      )}
    >
      <div className="w-16 h-16 rounded-2xl bg-surface-800/80 border border-surface-700/50 flex items-center justify-center mb-4 text-surface-500">
        {icon || <Inbox className="w-7 h-7" />}
      </div>
      <h3 className="text-base font-semibold text-surface-300 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-surface-500 max-w-sm mb-6">{description}</p>
      )}
      {action && (
        <Button variant="primary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
