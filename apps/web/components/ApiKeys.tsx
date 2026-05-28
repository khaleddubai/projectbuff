'use client';

import { useState } from 'react';
import {
  Key,
  Plus,
  Copy,
  Check,
  CheckCircle,
  Trash2,
  Eye,
  EyeOff,
  Clock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { cn, formatRelativeTime, getStatusBadgeClass } from '@/lib/utils';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Modal,
  ModalActions,
  EmptyState,
  Skeleton,
  ErrorState,
  StatusDot,
  Badge,
} from '@/components/ui';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/hooks/useApiKeys';

export default function ApiKeys() {
  const [showCreate, setShowCreate] = useState(false);
  const [showRevoke, setShowRevoke] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showKey, setShowKey] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyResult, setNewKeyResult] = useState<Record<string, unknown> | null>(null);

  const { data: keys, isLoading, error, refetch } = useApiKeys();
  const createApiKey = useCreateApiKey();
  const revokeApiKey = useRevokeApiKey();

  const handleCopy = async (key: string, id: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = key;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleCreate = () => {
    if (!newKeyName.trim()) return;
    createApiKey.mutate(
      { name: newKeyName },
      {
        onSuccess: (data) => {
          setNewKeyResult(data as Record<string, unknown>);
          setNewKeyName('');
        },
      }
    );
  };

  const handleRevoke = (id: string) => {
    revokeApiKey.mutate(id, {
      onSuccess: () => setShowRevoke(null),
    });
  };

  if (error) {
    return (
      <ErrorState
        title="Failed to load API keys"
        message="Could not fetch API keys from the server."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      {/* ===== Header ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">API Keys</h1>
          <p className="text-sm text-surface-400 mt-1">
            Manage API keys for programmatic access to AEGIS
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setNewKeyResult(null);
            setShowCreate(true);
          }}
        >
          Create Key
        </Button>
      </div>

      {/* ===== Key List ===== */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-24" />
          ))}
        </div>
      ) : !keys || keys.length === 0 ? (
        <EmptyState
          icon={<Key className="w-7 h-7" />}
          title="No API keys"
          description="Create your first API key to start integrating with AEGIS"
          action={{ label: 'Create Key', onClick: () => setShowCreate(true) }}
        />
      ) : (
        <div className="space-y-3">
          {(keys as Array<Record<string, unknown>>).map((key, i) => {
            const id = key.id as string;
            const name = key.name as string;
            const maskedKey = key.maskedKey as string;
            const keyValue = key.key as string;
            const status = key.status as string;
            const createdAt = key.createdAt as string;
            const lastUsedAt = key.lastUsedAt as string;
            const usageCount = key.usageCount as number;
            const isRevealed = showKey === id;

            return (
              <Card
                key={id}
                className="group"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <CardBody className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                          <Key className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-surface-200">
                            {name}
                          </h3>
                          <Badge
                            variant={status === 'active' ? 'success' : 'danger'}
                            size="sm"
                          >
                            {status}
                          </Badge>
                        </div>
                      </div>

                      {/* Key display */}
                      <div className="flex items-center gap-2 mt-2">
                        <code className="flex-1 px-3 py-1.5 rounded-lg bg-surface-800/80 border border-surface-700/50 text-xs font-mono text-surface-400 select-all truncate">
                          {isRevealed && keyValue
                            ? keyValue
                            : maskedKey || 'sk-****'}
                        </code>
                        {keyValue && (
                          <>
                            <button
                              onClick={() => handleCopy(keyValue, id)}
                              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-all"
                              title="Copy"
                            >
                              {copiedId === id ? (
                                <Check className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => setShowKey(isRevealed ? null : id)}
                              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-all"
                              title={isRevealed ? 'Hide' : 'Show'}
                            >
                              {isRevealed ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </>
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-surface-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Created {formatRelativeTime(createdAt)}
                        </span>
                        {lastUsedAt && (
                          <span className="flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" />
                            Used {formatRelativeTime(lastUsedAt)}
                          </span>
                        )}
                        <span>{usageCount || 0} requests</span>
                      </div>
                    </div>

                    {/* Actions */}
                    {status === 'active' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 className="w-3.5 h-3.5 text-rose-400" />}
                        onClick={() => setShowRevoke(id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* ===== Create Modal ===== */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create API Key"
        description="Generate a new API key for programmatic access"
        size="md"
      >
        {newKeyResult ? (
          <div className="space-y-5 animate-fade-in">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2 text-emerald-400 font-medium mb-2">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Key created successfully</span>
              </div>
              <p className="text-xs text-surface-400 mb-3">
                Copy this key now. You won&apos;t be able to see it again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-xs font-mono text-aegis-400 select-all">
                  {newKeyResult.key as string}
                </code>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={
                    copiedId === 'new-key' ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )
                  }
                  onClick={() => handleCopy(newKeyResult.key as string, 'new-key')}
                >
                  {copiedId === 'new-key' ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>
            <ModalActions>
              <Button
                variant="primary"
                onClick={() => {
                  setShowCreate(false);
                  setNewKeyResult(null);
                }}
              >
                Done
              </Button>
            </ModalActions>
          </div>
        ) : (
          <div className="space-y-5">
            <Input
              label="Key Name"
              placeholder="e.g., Production API Key"
              description="A friendly name to identify this key"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
            <ModalActions>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={createApiKey.isPending}
                disabled={!newKeyName.trim()}
                onClick={handleCreate}
              >
                Generate Key
              </Button>
            </ModalActions>
          </div>
        )}
      </Modal>

      {/* ===== Revoke Confirmation ===== */}
      <Modal
        open={!!showRevoke}
        onClose={() => setShowRevoke(null)}
        title="Revoke API Key"
        description="This action cannot be undone. Any services using this key will lose access."
        size="sm"
      >
        <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-rose-300">Warning</p>
            <p className="text-xs text-surface-400 mt-1">
              Revoking this key will immediately invalidate it. All requests
              using this key will be rejected.
            </p>
          </div>
        </div>
        <ModalActions>
          <Button variant="ghost" onClick={() => setShowRevoke(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={revokeApiKey.isPending}
            onClick={() => showRevoke && handleRevoke(showRevoke)}
          >
            Revoke Key
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
