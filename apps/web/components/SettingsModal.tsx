'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  Database,
  Shield,
  Bell,
  Server,
  Lock,
  Key,
  Save,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal, ModalActions, Button, Card, CardBody } from '@/components/ui';
import { Input } from '@/components/ui';
import { settings as settingsApi } from '@/lib/api-client';
import { toast } from 'sonner';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type SettingsTab = 'llm' | 'embedding' | 'security' | 'notifications' | 'server' | 'auth';
type LLMProvider = 'nvidia' | 'openrouter';

const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'llm', label: 'LLM', icon: Brain },
  { id: 'embedding', label: 'Embedding', icon: Database },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'server', label: 'Server', icon: Server },
  { id: 'auth', label: 'Auth', icon: Lock },
];

interface FormState {
  llmProvider: LLMProvider;
  nvidia: { apiKey: string; baseUrl: string; model: string };
  openrouter: { apiKey: string; baseUrl: string; model: string };
  embedding: { model: string; dimensions: string };
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('llm');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<FormState>({
    llmProvider: 'nvidia',
    nvidia: {
      apiKey: '',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      model: 'nvidia/nemotron-4-340b-instruct',
    },
    openrouter: {
      apiKey: '',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'openrouter/free',
    },
    embedding: {
      model: 'openai/text-embedding-3-small',
      dimensions: '1536',
    },
  });

  // Fetch current settings from API when modal opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = (await settingsApi.get()) as Record<string, string>;
        if (cancelled) return;

        setForm((prev) => ({
          ...prev,
          llmProvider: (data.LLM_PROVIDER as LLMProvider) || 'nvidia',
          nvidia: {
            apiKey: (data.NVIDIA_API_KEY as string) || prev.nvidia.apiKey,
            baseUrl: (data.NVIDIA_BASE_URL as string) || prev.nvidia.baseUrl,
            model: (data.NVIDIA_MODEL as string) || prev.nvidia.model,
          },
          openrouter: {
            apiKey: (data.OPENROUTER_API_KEY as string) || prev.openrouter.apiKey,
            baseUrl: (data.OPENROUTER_BASE_URL as string) || prev.openrouter.baseUrl,
            model: (data.OPENROUTER_MODEL as string) || prev.openrouter.model,
          },
          embedding: {
            model: (data.EMBEDDING_MODEL as string) || prev.embedding.model,
            dimensions: (data.EMBEDDING_DIMENSIONS as string) || prev.embedding.dimensions,
          },
        }));
      } catch (err) {
        if (!cancelled) toast.error('Failed to load settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [open]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await settingsApi.update({
        // Provider selection
        LLM_PROVIDER: form.llmProvider,
        // NVIDIA settings
        NVIDIA_API_KEY: form.nvidia.apiKey,
        NVIDIA_BASE_URL: form.nvidia.baseUrl,
        NVIDIA_MODEL: form.nvidia.model,
        // OpenRouter settings
        OPENROUTER_API_KEY: form.openrouter.apiKey,
        OPENROUTER_BASE_URL: form.openrouter.baseUrl,
        OPENROUTER_MODEL: form.openrouter.model,
        // Embedding
        EMBEDDING_MODEL: form.embedding.model,
        EMBEDDING_DIMENSIONS: form.embedding.dimensions,
      });
      toast.success('Settings saved successfully');
      onClose();
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [form, onClose]);

  const updateNvidia = (field: string, value: string) =>
    setForm((f) => ({ ...f, nvidia: { ...f.nvidia, [field]: value } }));

  const updateOpenrouter = (field: string, value: string) =>
    setForm((f) => ({ ...f, openrouter: { ...f.openrouter, [field]: value } }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="System Settings"
      description="Configure AEGIS system preferences"
      size="xl"
    >
      <div className="flex gap-6 -m-6">
        {/* ===== Sidebar Tabs ===== */}
        <nav className="w-44 shrink-0 p-4 border-r border-surface-700/30 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  isActive
                    ? 'bg-aegis-500/10 text-aegis-400 border border-aegis-500/20'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50 border border-transparent'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ===== Content ===== */}
        <div className="flex-1 min-w-0 p-4 pr-6 overflow-y-auto max-h-[65vh] scrollbar-custom">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="w-5 h-5 animate-spin text-surface-400" />
            </div>
          ) : (
            <>
              {/* ===== LLM Settings ===== */}
              {activeTab === 'llm' && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <h3 className="text-base font-semibold text-surface-200">
                      LLM Configuration
                    </h3>
                    <p className="text-sm text-surface-500 mt-1">
                      Select your AI provider and configure API credentials
                    </p>
                  </div>

                  {/* Provider Selector */}
                  <div className="flex gap-2">
                    {(['nvidia', 'openrouter'] as LLMProvider[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setForm((f) => ({ ...f, llmProvider: p }))}
                        className={cn(
                          'flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all border',
                          form.llmProvider === p
                            ? 'bg-aegis-500/10 text-aegis-400 border-aegis-500/30 shadow-[0_0_12px_rgba(34,211,238,0.06)]'
                            : 'bg-surface-800/50 text-surface-400 border-surface-700/30 hover:text-surface-200 hover:border-surface-600/50'
                        )}
                      >
                        <div className="text-base font-semibold mb-0.5">
                          {p === 'nvidia' ? 'NVIDIA' : 'OpenRouter'}
                        </div>
                        <div className="text-[10px] opacity-60">
                          {p === 'nvidia' ? 'Nemotron-4 340B' : 'Free models'}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Conditional Fields */}
                  {form.llmProvider === 'nvidia' ? (
                    <div className="space-y-4 p-4 rounded-xl border border-surface-700/30 bg-surface-900/50">
                      <div className="flex items-center gap-2 text-xs text-surface-500 font-mono uppercase tracking-wider">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        NVIDIA Configuration
                      </div>
                      <Input
                        label="API Key"
                        type="password"
                        value={form.nvidia.apiKey}
                        onChange={(e) => updateNvidia('apiKey', e.target.value)}
                        icon={<Key className="w-4 h-4" />}
                        placeholder="nvapi-..."
                        description="Your NVIDIA API key"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                          label="Base URL"
                          value={form.nvidia.baseUrl}
                          onChange={(e) => updateNvidia('baseUrl', e.target.value)}
                          placeholder="https://integrate.api.nvidia.com/v1"
                        />
                        <Input
                          label="Model"
                          value={form.nvidia.model}
                          onChange={(e) => updateNvidia('model', e.target.value)}
                          placeholder="nvidia/nemotron-4-340b-instruct"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 p-4 rounded-xl border border-surface-700/30 bg-surface-900/50">
                      <div className="flex items-center gap-2 text-xs text-surface-500 font-mono uppercase tracking-wider">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                        OpenRouter Configuration
                      </div>
                      <Input
                        label="API Key"
                        type="password"
                        value={form.openrouter.apiKey}
                        onChange={(e) => updateOpenrouter('apiKey', e.target.value)}
                        icon={<Key className="w-4 h-4" />}
                        placeholder="sk-or-v1-..."
                        description="Your OpenRouter API key"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                          label="Base URL"
                          value={form.openrouter.baseUrl}
                          onChange={(e) => updateOpenrouter('baseUrl', e.target.value)}
                          placeholder="https://openrouter.ai/api/v1"
                        />
                        <Input
                          label="Model"
                          value={form.openrouter.model}
                          onChange={(e) => updateOpenrouter('model', e.target.value)}
                          placeholder="openrouter/free"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Embedding Settings */}
              {activeTab === 'embedding' && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <h3 className="text-base font-semibold text-surface-200">
                      Embedding Configuration
                    </h3>
                    <p className="text-sm text-surface-500 mt-1">
                      Configure vector embedding model — uses the active LLM provider&apos;s API key
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Model"
                      value={form.embedding.model}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          embedding: { ...f.embedding, model: e.target.value },
                        }))
                      }
                      icon={<Database className="w-4 h-4" />}
                      placeholder="openai/text-embedding-3-small"
                    />
                    <Input
                      label="Dimensions"
                      type="number"
                      value={form.embedding.dimensions}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          embedding: { ...f.embedding, dimensions: e.target.value },
                        }))
                      }
                      placeholder="1536"
                    />
                  </div>
                </div>
              )}

              {/* Security Settings */}
              {activeTab === 'security' && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <h3 className="text-base font-semibold text-surface-200">
                      Security Settings
                    </h3>
                    <p className="text-sm text-surface-500 mt-1">
                      Manage encryption, rate limiting, and session settings
                    </p>
                  </div>
                  <div className="space-y-4">
                    <Card>
                      <CardBody className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-surface-200">Encryption Enabled</p>
                          <p className="text-xs text-surface-500 mt-0.5">Encrypt sensitive data at rest</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" defaultChecked className="sr-only peer" />
                          <div className="w-10 h-6 bg-surface-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-aegis-400/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aegis-500" />
                        </label>
                      </CardBody>
                    </Card>
                    <Card>
                      <CardBody className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-surface-200">Rate Limiting</p>
                          <p className="text-xs text-surface-500 mt-0.5">Limit requests per API key</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" defaultChecked className="sr-only peer" />
                          <div className="w-10 h-6 bg-surface-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-aegis-400/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aegis-500" />
                        </label>
                      </CardBody>
                    </Card>
                  </div>
                </div>
              )}

              {/* Notifications */}
              {activeTab === 'notifications' && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <h3 className="text-base font-semibold text-surface-200">Notification Settings</h3>
                    <p className="text-sm text-surface-500 mt-1">Configure webhook and notification preferences</p>
                  </div>
                  <Card>
                    <CardBody className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-surface-200">Enable Notifications</p>
                        <p className="text-xs text-surface-500 mt-0.5">Receive notifications for mission events</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-10 h-6 bg-surface-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-aegis-400/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aegis-500" />
                      </label>
                    </CardBody>
                  </Card>
                </div>
              )}

              {/* Server */}
              {activeTab === 'server' && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <h3 className="text-base font-semibold text-surface-200">Server Configuration</h3>
                    <p className="text-sm text-surface-500 mt-1">Manage API server settings and CORS</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Port" type="number" defaultValue="3001" icon={<Server className="w-4 h-4" />} />
                    <Input label="CORS Origins" defaultValue="http://localhost:3000" />
                  </div>
                  <Card>
                    <CardBody className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-surface-200">Metrics Enabled</p>
                        <p className="text-xs text-surface-500 mt-0.5">Collect and expose Prometheus metrics</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-10 h-6 bg-surface-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-aegis-400/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aegis-500" />
                      </label>
                    </CardBody>
                  </Card>
                </div>
              )}

              {/* Auth */}
              {activeTab === 'auth' && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <h3 className="text-base font-semibold text-surface-200">Authentication Settings</h3>
                    <p className="text-sm text-surface-500 mt-1">Manage authentication settings</p>
                  </div>
                  <Card>
                    <CardBody className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-surface-200">Auth Disabled</p>
                        <p className="text-xs text-surface-500 mt-0.5">Disable authentication (development only)</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-10 h-6 bg-surface-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-aegis-400/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500" />
                      </label>
                    </CardBody>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ModalActions>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          icon={saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          loading={saving}
          onClick={handleSave}
        >
          Save Changes
        </Button>
      </ModalActions>
    </Modal>
  );
}
