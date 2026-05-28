'use client';

import { useState } from 'react';
import {
  Rocket,
  Play,
  Square,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  FileText,
  Bot,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  Zap,
  X,
} from 'lucide-react';
import { cn, formatRelativeTime, formatDuration } from '@/lib/utils';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Badge,
  Input,
  EmptyState,
  Skeleton,
  ErrorState,
  StatusDot,
  Modal,
  ModalActions,
} from '@/components/ui';
import { useMissions, useExecuteMission, useCancelMission } from '@/hooks/useMissions';

export default function Missions() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMission, setSelectedMission] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMissionIdea, setNewMissionIdea] = useState('');

  const { data: missions, isLoading, error, refetch } = useMissions(statusFilter);
  const executeMission = useExecuteMission();
  const cancelMission = useCancelMission();

  const filtered = (missions || []).filter((m) => {
    const name = (m.name as string) || '';
    const idea = (m.idea as string) || '';
    const q = searchQuery.toLowerCase();
    return !q || name.toLowerCase().includes(q) || idea.toLowerCase().includes(q);
  });

  const statuses = ['all', 'running', 'completed', 'failed', 'pending'];

  if (error) {
    return (
      <ErrorState
        title="Failed to load missions"
        message="Could not fetch mission data from the API."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* ===== Header ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Mission Control</h1>
          <p className="text-sm text-surface-400 mt-1">
            Manage and monitor AI agent missions
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          icon={<Zap className="w-4 h-4" />}
          onClick={() => setShowCreateModal(true)}
        >
          New Mission
        </Button>
      </div>

      {/* ===== Filters ===== */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search missions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-800/60 border border-surface-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-surface-200 placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-aegis-400/30 focus:border-aegis-500/50 transition-all"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hidden">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-3.5 py-2 rounded-xl text-xs font-medium border transition-all whitespace-nowrap',
                statusFilter === status
                  ? 'bg-aegis-500/10 text-aegis-400 border-aegis-500/20'
                  : 'bg-surface-800/60 text-surface-400 border-surface-700/40 hover:text-surface-200 hover:border-surface-600'
              )}
            >
              {status === 'all'
                ? 'All'
                : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ===== Mission List ===== */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-28" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Rocket className="w-7 h-7" />}
          title={searchQuery ? 'No missions match your search' : 'No missions yet'}
          description={
            searchQuery
              ? 'Try adjusting your search or filters'
              : 'Launch your first AI mission to get started'
          }
          action={
            !searchQuery
              ? { label: 'Create Mission', onClick: () => setShowCreateModal(true) }
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((mission, i) => {
            const id = mission.id as string;
            const name = mission.name as string;
            const idea = mission.idea as string;
            const status = mission.status as string;
            const createdAt = mission.createdAt as string;
            const isSelected = selectedMission === id;

            return (
              <Card
                key={id}
                className={cn(
                  'cursor-pointer group transition-all',
                  isSelected && 'border-aegis-500/30 shadow-[0_0_15px_rgba(34,211,238,0.06)]'
                )}
                style={{ animationDelay: `${i * 50}ms` }}
                onClick={() => setSelectedMission(isSelected ? null : id)}
              >
                <CardBody className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Status icon */}
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border',
                        status === 'completed'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : status === 'running'
                          ? 'bg-aegis-500/10 border-aegis-500/20 text-aegis-400'
                          : status === 'failed'
                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                          : 'bg-surface-800 border-surface-700 text-surface-400'
                      )}
                    >
                      {status === 'completed' ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : status === 'running' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : status === 'failed' ? (
                        <AlertTriangle className="w-5 h-5" />
                      ) : (
                        <Clock className="w-5 h-5" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-surface-200 truncate">
                          {name}
                        </h3>
                        <Badge
                          variant={
                            status === 'completed'
                              ? 'success'
                              : status === 'running'
                              ? 'info'
                              : status === 'failed'
                              ? 'danger'
                              : 'default'
                          }
                          size="sm"
                        >
                          {status}
                        </Badge>
                      </div>
                      {idea && (
                        <p className="text-sm text-surface-400 line-clamp-2 mb-2">
                          {idea.slice(0, 200)}{idea.length > 200 ? '...' : ''}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-surface-500">
                        <span className="flex items-center gap-1">
                          <Bot className="w-3 h-3" />
                          Conductor
                        </span>
                        {createdAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatRelativeTime(createdAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {(status === 'running' || status === 'pending') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Square className="w-3.5 h-3.5 text-rose-400" />}
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelMission.mutate(id);
                          }}
                          loading={cancelMission.isPending}
                        >
                          Cancel
                        </Button>
                      )}
                      {isSelected ? (
                        <ChevronDown className="w-4 h-4 text-surface-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-surface-500 group-hover:text-surface-400 transition-colors" />
                      )}
                    </div>
                  </div>

                  {/* ===== Expanded: Logs / Steps ===== */}
                  {isSelected && (
                    <div className="mt-4 pt-4 border-t border-surface-700/30 animate-fade-in">
                      <div className="space-y-2">
                        {(mission.logs as Array<Record<string, unknown>>)?.slice(0, 10).map(
                          (log: Record<string, unknown>, li: number) => (
                            <div
                              key={li}
                              className="flex items-start gap-3 px-3 py-2 rounded-xl bg-surface-800/50"
                            >
                              <StatusDot
                                status={log.type === 'error' ? 'error' : log.type === 'file' ? 'active' : 'completed'}
                                size="sm"
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-surface-300">
                                  <span className="font-medium text-aegis-400">[{log.agent as string}]</span>
                                  {' '}
                                  {(log.message as string)?.slice(0, 200)}
                                </p>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* ===== Create Mission Modal ===== */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Launch New Mission"
        description="Describe what you want the AI agents to build"
        size="lg"
      >
        <div className="space-y-5">
          <Input
            label="Mission Idea"
            placeholder="e.g., Build a full-stack note-taking app with Next.js, Express, and PostgreSQL. Include user auth, CRUD operations, and a clean UI..."
            value={newMissionIdea}
            onChange={(e) => setNewMissionIdea(e.target.value)}
          />
          <p className="text-xs text-surface-500">
            The AEGIS conductor agent will analyze your idea and dispatch specialized agents
            (architect, backend engineer, frontend engineer, devops, QA, tech writer) to build it.
          </p>
        </div>
        <ModalActions>
          <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={<Zap className="w-4 h-4" />}
            loading={executeMission.isPending}
            disabled={newMissionIdea.trim().length < 3}
            onClick={() => {
              executeMission.mutate({ idea: newMissionIdea });
              setShowCreateModal(false);
              setNewMissionIdea('');
            }}
          >
            Launch Mission
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
