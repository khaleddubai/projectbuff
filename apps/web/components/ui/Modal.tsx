'use client';

import { useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  showClose?: boolean;
}

const sizeStyles = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw] max-h-[95vh]',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  className,
  showClose = true,
}: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, handleEscape]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full bg-surface-900 border border-surface-700/60 rounded-2xl shadow-2xl animate-scale-in',
          'max-h-[90vh] overflow-hidden flex flex-col',
          sizeStyles[size],
          className
        )}
      >
        {/* Header */}
        {(title || showClose) && (
          <div className="flex items-start justify-between px-6 py-5 border-b border-surface-700/30 shrink-0">
            <div className="min-w-0 flex-1">
              {title && (
                <h2 className="text-lg font-semibold text-surface-100">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-sm text-surface-500 mt-0.5">{description}</p>
              )}
            </div>
            {showClose && (
              <button
                onClick={onClose}
                className="ml-4 p-1.5 rounded-xl text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-custom p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ModalActions({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-700/30 shrink-0',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
