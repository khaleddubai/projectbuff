'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  Database,
  Zap,
  HardDrive,
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  CheckCircle,
  Play,
  Search,
  Shield,
} from 'lucide-react';
import { cn, formatRelativeTime, formatNumber, formatBytes } from '@/lib/utils';
import { Card, CardHeader, CardBody, Skeleton, ErrorState, StatusDot } from '@/components/ui';
import { useStats } from '@/hooks/useStats';
import { Button } from '@/components/ui/Button';

interface OverviewProps {
  onNavigate: (tab: string) => void;
}

export default function Overview({ onNavigate }: OverviewProps) {
  const { data: statsData, isLoading, error, refetch } = useStats();
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  if (error) {
    return (
      <ErrorState
        title="Failed to load system stats"
        message="Could not connect to the API server. Make sure it's running on localhost:3001."
        onRetry={() => refetch()}
      />
    );
  }

  const systemStatus = (statsData?.status as string) || 'healthy';
  const stats = {
    missionsTotal: (statsData?.missionsTotal as number) || 0,
    missionsActive: (statsData?.missionsActive as number) || 0,
    missionsCompleted: (statsData?.missionsCompleted as number) || 0,
    missionsFailed: (statsData?.missionsFailed as number) || 0,
    agentsActive: (statsData?.agentsActive as number) || 0,
    apiKeysTotal: (statsData?.apiKeysTotal as number) || 0,
    tokensUsed: (statsData?.tokensUsed as number) || 0,
    uptime: (statsData?.uptime as number) || 0,
    cpuUsage: (statsData?.cpuUsage as number) || 0,
    memoryUsage: (statsData?.memoryUsage as number) || 0,
    vectorStoreSize: (statsData?.vectorStoreSize as number) || 0,
  };

  const statCards = [
    {
      label: 'Total Missions',
      value: formatNumber(stats.missionsTotal),
      icon: Zap,
      color: 'text-aegis-400',
      bg: 'bg-aegis-500/10',
      border: 'border-aegis-500/20',
    },
    {
      label: 'Active Missions',
      value: formatNumber(stats.missionsActive),
      icon: Play,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      pulse: true,
    },
    {
      label: 'Agents Online',
      value: formatNumber(stats.agentsActive),
      icon: Cpu,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
    },
    {
      label: 'API Keys',
      value: formatNumber(stats.apiKeysTotal),
      icon: Shield,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      label: 'Tokens Used',
      value: formatNumber(stats.tokensUsed),
      icon: Database,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
    },
    {
      label: 'Vector Store',
      value: formatBytes(stats.vectorStoreSize),
      icon: HardDrive,
      color: 'text-aegis-400',
      bg: 'bg-aegis-500/10',
      border: 'border-aegis-500/20',
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-fade-in">
      {/* ===== Greeting ===== */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {greeting}, Director
        </h1>
        <p className="text-sm text-surface-400 mt-1">
          System is{' '}
          <span
            className={cn(
              'font-medium',
              systemStatus === 'healthy' && 'text-emerald-400',
              systemStatus === 'degraded' && 'text-amber-400',
              systemStatus === 'error' && 'text-rose-400'
            )}
          >
            {systemStatus}
          </span>{' '}
          &mdash; everything is running smoothly
        </p>
      </div>

      {/* ===== Status Bar ===== */}
      <div className="flex items-center gap-4 px-5 py-3 rounded-2xl bg-surface-800/50 border border-surface-700/30">
        <div className="flex items-center gap-2">
          <StatusDot status={systemStatus} />
          <span className="text-sm font-medium text-surface-300">
            System {systemStatus}
          </span>
        </div>
        <div className="w-px h-6 bg-surface-700/50" />
        <div className="flex items-center gap-1.5 text-xs text-surface-500">
          <Clock className="w-3.5 h-3.5" />
          <span>Up {Math.floor(stats.uptime / 3600)}h {Math.floor((stats.uptime % 3600) / 60)}m</span>
        </div>
        <div className="w-px h-6 bg-surface-700/50" />
        <div className="flex items-center gap-1.5 text-xs text-surface-500">
          <Cpu className="w-3.5 h-3.5" />
          <span>{stats.cpuUsage}% CPU</span>
        </div>
        <div className="w-px h-6 bg-surface-700/50" />
        <div className="flex items-center gap-1.5 text-xs text-surface-500">
          <Activity className="w-3.5 h-3.5" />
          <span>{formatBytes(stats.memoryUsage)} RAM</span>
        </div>
      </div>

      {/* ===== Stat Cards Grid ===== */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {statCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.label}
                className="relative overflow-hidden group"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <CardBody className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center border',
                        stat.bg,
                        stat.border
                      )}
                    >
                      <Icon className={cn('w-5 h-5', stat.color)} />
                    </div>
                    {stat.pulse && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-white tracking-tight">
                      {stat.value}
                    </p>
                    <p className="text-xs text-surface-400 font-medium">
                      {stat.label}
                    </p>
                  </div>
                </CardBody>
                {/* Subtle gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-aegis-500/0 group-hover:to-aegis-500/[0.02] transition-all duration-500 pointer-events-none" />
              </Card>
            );
          })}
        </div>
      )}

      {/* ===== Bottom Section: Recent Activity + Quick Actions ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-aegis-400" />
              <h2 className="text-sm font-semibold text-surface-200">
                Recent Activity
              </h2>
            </div>
            <span className="text-xs text-surface-500">Live feed</span>
          </CardHeader>
          <CardBody>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton variant="circle" className="w-8 h-8 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {[
                  {
                    id: '1',
                    type: 'mission' as const,
                    message: 'Code review mission completed',
                    status: 'success' as const,
                    time: '2m ago',
                  },
                  {
                    id: '2',
                    type: 'agent' as const,
                    message: 'Agent deployed to production environment',
                    status: 'success' as const,
                    time: '5m ago',
                  },
                  {
                    id: '3',
                    type: 'system' as const,
                    message: 'Vector store index updated',
                    status: 'running' as const,
                    time: '8m ago',
                  },
                  {
                    id: '4',
                    type: 'auth' as const,
                    message: 'New API key generated',
                    status: 'success' as const,
                    time: '15m ago',
                  },
                ].map((activity, i) => (
                  <div
                    key={activity.id}
                    className={cn(
                      'flex items-start gap-3 px-3 py-3 rounded-xl transition-all hover:bg-surface-800/50',
                      'animate-fade-in'
                    )}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border',
                        activity.type === 'mission'
                          ? 'bg-aegis-500/10 border-aegis-500/20 text-aegis-400'
                          : activity.type === 'agent'
                          ? 'bg-violet-500/10 border-violet-500/20 text-violet-400'
                          : activity.type === 'system'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      )}
                    >
                      {activity.type === 'mission' ? (
                        <Zap className="w-4 h-4" />
                      ) : activity.type === 'agent' ? (
                        <Cpu className="w-4 h-4" />
                      ) : activity.type === 'system' ? (
                        <Activity className="w-4 h-4" />
                      ) : (
                        <Shield className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-300">{activity.message}</p>
                      <p className="text-xs text-surface-500 mt-0.5">{activity.time}</p>
                    </div>
                    <StatusDot status={activity.status} />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-surface-200">
                Quick Actions
              </h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-2">
            <Button
              variant="primary"
              className="w-full justify-start"
              icon={<Zap className="w-4 h-4" />}
              onClick={() => onNavigate('missions')}
            >
              New Mission
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start"
              icon={<Search className="w-4 h-4" />}
              onClick={() => onNavigate('search')}
            >
              Search Knowledge Base
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start"
              icon={<Shield className="w-4 h-4" />}
              onClick={() => onNavigate('api-keys')}
            >
              Manage API Keys
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start"
              icon={<Activity className="w-4 h-4" />}
              onClick={() => onNavigate('settings')}
            >
              System Settings
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
