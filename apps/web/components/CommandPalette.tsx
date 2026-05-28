'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Rocket,
  Key,
  Search,
  Settings,
  Terminal,
  HelpCircle,
  Command,
  Zap,
  Shield,
  BarChart3,
} from 'lucide-react';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  shortcut?: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

export function CommandPalette({ open, onClose, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: Command[] = [
    {
      id: 'overview',
      label: 'Go to Overview',
      description: 'View system dashboard and stats',
      icon: LayoutDashboard,
      action: () => { onNavigate('overview'); onClose(); },
      shortcut: ['G', 'O'],
    },
    {
      id: 'missions',
      label: 'Go to Missions',
      description: 'Manage and monitor AI missions',
      icon: Rocket,
      action: () => { onNavigate('missions'); onClose(); },
      shortcut: ['G', 'M'],
    },
    {
      id: 'api-keys',
      label: 'Go to API Keys',
      description: 'Manage API authentication keys',
      icon: Key,
      action: () => { onNavigate('api-keys'); onClose(); },
      shortcut: ['G', 'K'],
    },
    {
      id: 'search',
      label: 'Go to Search',
      description: 'Search through knowledge base',
      icon: Search,
      action: () => { onNavigate('search'); onClose(); },
      shortcut: ['G', 'S'],
    },
    {
      id: 'settings',
      label: 'Open Settings',
      description: 'Configure system preferences',
      icon: Settings,
      action: () => { onNavigate('settings'); onClose(); },
      shortcut: ['⌘', ','],
    },
    {
      id: 'new-mission',
      label: 'New Mission',
      description: 'Launch a new AI mission',
      icon: Zap,
      action: () => { onNavigate('missions'); onClose(); },
      shortcut: ['⌘', 'N'],
    },
    {
      id: 'status',
      label: 'System Status',
      description: 'Check system health and metrics',
      icon: BarChart3,
      action: () => { onNavigate('overview'); onClose(); },
    },
  ];

  const filtered = query.trim()
    ? commands.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.description?.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          filtered[selectedIndex]?.action();
          break;
        case 'Escape':
          onClose();
          break;
      }
    },
    [filtered, selectedIndex, onClose]
  );

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative w-full max-w-xl bg-surface-900 border border-surface-700/60 rounded-2xl shadow-2xl animate-fade-in-up overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-700/30">
          <Search className="w-5 h-5 text-surface-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-surface-100 placeholder:text-surface-500 text-base outline-none"
          />
          <kbd className="kbd">esc</kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-72 overflow-y-auto scrollbar-custom p-2"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-surface-500">
              No results found
            </div>
          ) : (
            filtered.map((cmd, index) => (
              <button
                key={cmd.id}
                onClick={() => cmd.action()}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all',
                  index === selectedIndex
                    ? 'bg-aegis-500/10 text-aegis-400'
                    : 'text-surface-300 hover:bg-surface-800/50'
                )}
              >
                <cmd.icon className="w-4 h-4 shrink-0 opacity-70" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{cmd.label}</div>
                  {cmd.description && (
                    <div className="text-xs text-surface-500">{cmd.description}</div>
                  )}
                </div>
                {cmd.shortcut && (
                  <div className="flex items-center gap-0.5">
                    {cmd.shortcut.map((k, i) => (
                      <kbd key={i} className="kbd">
                        {k}
                      </kbd>
                    ))}
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-5 py-3 border-t border-surface-700/30 bg-surface-950/50">
          <div className="flex items-center gap-1.5 text-[10px] text-surface-500">
            <Command className="w-3 h-3" />
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-surface-500">
            <kbd className="kbd text-[8px] px-1">↵</kbd>
            <span>Open</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-surface-500">
            <kbd className="kbd text-[8px] px-1">esc</kbd>
            <span>Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
