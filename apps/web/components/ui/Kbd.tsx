'use client';

import { cn } from '@/lib/utils';

interface KbdProps {
  keys: string[];
  size?: 'sm' | 'md';
  className?: string;
}

export function Kbd({ keys, size = 'sm', className }: KbdProps) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {keys.map((key, i) => (
        <kbd
          key={i}
          className={cn(
            'inline-flex items-center justify-center font-mono rounded border border-surface-700 bg-surface-800 text-surface-400',
            size === 'sm'
              ? 'px-1.5 h-5 text-[10px] min-w-[20px]'
              : 'px-2 h-6 text-xs min-w-[24px]'
          )}
        >
          {key === 'cmd' ? '⌘' : key === 'shift' ? '⇧' : key === 'alt' ? '⌥' : key === 'ctrl' ? '⌃' : key === 'enter' ? '↵' : key === 'escape' ? 'Esc' : key === 'space' ? '␣' : key === 'tab' ? '⇥' : key === 'backspace' ? '⌫' : key === 'delete' ? '⌦' : key}
        </kbd>
      ))}
    </span>
  );
}
