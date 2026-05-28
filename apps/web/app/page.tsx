'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Shield,
  LayoutDashboard,
  Rocket,
  Key,
  Search,
  Settings,
  Server,
  ChevronDown,
  ChevronRight,
  Menu,
  PanelLeftClose,
  Command,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useKeyboard } from '@/hooks/useKeyboard';
import Overview from '@/components/Overview';
import Missions from '@/components/Missions';
import ApiKeys from '@/components/ApiKeys';
import SearchTab from '@/components/Search';
import SettingsModal from '@/components/SettingsModal';
import { CommandPalette } from '@/components/CommandPalette';
import { Kbd } from '@/components/ui';
import type { Tab } from '@/lib/types';

const tabs: { id: Tab; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, description: 'System dashboard and metrics' },
  { id: 'missions', label: 'Missions', icon: Rocket, description: 'AI agent mission control' },
  { id: 'api-keys', label: 'API Keys', icon: Key, description: 'Authentication management' },
  { id: 'search', label: 'Search', icon: Search, description: 'Knowledge base search' },
];

const tabHeaders: Record<Tab, string> = {
  overview: 'DASHBOARD',
  missions: 'MISSION CONTROL',
  'api-keys': 'AUTHENTICATION',
  search: 'KNOWLEDGE BASE',
};

const tabDescriptions: Record<Tab, string> = {
  overview: 'System overview and real-time metrics',
  missions: 'Manage and monitor AI agent missions',
  'api-keys': 'Manage API authentication keys and access',
  search: 'Search through the knowledge base',
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleNavigate = useCallback((tab: string) => {
    if (tab === 'settings') {
      setShowSettings(true);
      return;
    }
    setActiveTab(tab as Tab);
  }, []);

  // Keyboard shortcuts
  useKeyboard([
    { key: 'k', meta: true, handler: () => setShowCommandPalette((p) => !p) },
    { key: 'o', meta: true, handler: () => setActiveTab('overview') },
    { key: 'm', meta: true, handler: () => setActiveTab('missions') },
    { key: 'k', meta: true, shift: true, handler: () => setActiveTab('api-keys') },
    { key: 's', meta: true, handler: () => setActiveTab('search') },
    { key: ',', meta: true, handler: () => setShowSettings(true) },
    { key: 'b', meta: true, handler: () => setSidebarCollapsed((p) => !p) },
  ]);

  return (
    <div className="h-screen overflow-hidden flex">
      {/* ===== Background Effects ===== */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[40%] h-[40%] rounded-full bg-aegis-500/3 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[30%] h-[30%] rounded-full bg-violet-500/3 blur-[100px]" />
      </div>

      {/* ===== Sidebar ===== */}
      <aside
        className={cn(
          'relative z-10 flex flex-col shrink-0 border-r border-surface-800 bg-surface-950/80 backdrop-blur-xl transition-all duration-300',
          sidebarCollapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Logo + Collapse Toggle */}
        <div className="h-16 flex items-center gap-2 px-3 border-b border-surface-800/50">
          {/* Collapse toggle — always visible at the top */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-surface-500 hover:text-surface-200 hover:bg-surface-800/60 transition-all duration-200 group relative"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <Menu className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
            {/* Tooltip on hover */}
            <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-surface-800 text-[10px] text-surface-300 font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-surface-700/50 z-50">
              {sidebarCollapsed ? 'Expand (⌘B)' : 'Collapse (⌘B)'}
            </span>
          </button>

          {/* Logo */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-aegis-400 to-aegis-600 flex items-center justify-center shadow-glow-cyan">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-surface-950" />
            </div>
            {!sidebarCollapsed && (
              <div className="animate-fade-in overflow-hidden">
                <h1 className="text-base font-bold text-white tracking-tight leading-tight">AEGIS</h1>
                <p className="text-[9px] text-aegis-400 font-mono uppercase tracking-[0.15em] leading-tight">
                  Director&apos;s OS
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hidden">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const shortcutLetters: Record<string, string> = {
              overview: '⌘O',
              missions: '⌘M',
              'api-keys': '⇧⌘K',
              search: '⌘S',
            };
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                  isActive
                    ? 'bg-aegis-500/10 text-aegis-400 border border-aegis-500/20 shadow-[0_0_12px_rgba(34,211,238,0.06)]'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50 border border-transparent'
                )}
                title={sidebarCollapsed ? tab.label : undefined}
              >
                <Icon className={cn('w-4 h-4 shrink-0 transition-transform', isActive && 'scale-110')} />
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left">{tab.label}</span>
                    {mounted && (
                      <span className="text-[10px] font-mono text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        {shortcutLetters[tab.id]}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-3 border-t border-surface-800/50 space-y-1">
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-400 hover:text-surface-200 hover:bg-surface-800/50 transition-all border border-transparent"
            title={sidebarCollapsed ? 'Settings' : undefined}
          >
            <Settings className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Settings</span>}
          </button>

          {!sidebarCollapsed && (
            <div className="px-3 pt-3 mt-2 border-t border-surface-800/30 space-y-1.5 animate-fade-in">
              <div className="flex items-center gap-1.5 text-[10px] text-surface-600">
                <Server className="w-3 h-3" />
                <span>API: localhost:3001</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-surface-600">
                <Command className="w-3 h-3" />
                <span>⌘K to open commands</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ===== Main Content ===== */}
      <main className="relative z-10 flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b border-surface-800/50 bg-surface-950/40 backdrop-blur-xl flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-800/80 text-[11px] font-mono text-surface-400 border border-surface-700/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" />
                {tabHeaders[activeTab]}
              </div>
              {!sidebarCollapsed && (
                <span className="text-[11px] text-surface-600 hidden sm:inline">
                  {tabDescriptions[activeTab]}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCommandPalette(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] text-surface-500 bg-surface-800/50 border border-surface-700/30 hover:text-surface-300 hover:border-surface-600/50 transition-all"
            >
              <Command className="w-3 h-3" />
              <span>Command</span>
              <Kbd keys={['⌘', 'K']} />
            </button>
            <div className="flex items-center gap-1.5 text-xs text-surface-500">
              <Server className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">localhost:3001</span>
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto scrollbar-custom p-6 lg:p-8">
          {activeTab === 'overview' && <Overview onNavigate={handleNavigate} />}
          {activeTab === 'missions' && <Missions />}
          {activeTab === 'api-keys' && <ApiKeys />}
          {activeTab === 'search' && <SearchTab />}
        </div>
      </main>

      {/* Command Palette */}
      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigate={handleNavigate}
      />

      {/* Settings Modal */}
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
