/* =============================================
   AEGIS — Shared Frontend Types
   ============================================= */

// === Navigation ===
export type Tab = 'overview' | 'missions' | 'api-keys' | 'search';

export interface TabConfig {
  id: Tab;
  label: string;
  icon: string; // lucide icon name
  description: string;
}

// === Stats ===
export interface SystemStats {
  uptime: number;
  missionsTotal: number;
  missionsActive: number;
  missionsCompleted: number;
  missionsFailed: number;
  agentsActive: number;
  apiKeysTotal: number;
  apiKeysActive: number;
  tokensUsed: number;
  tokensEstimatedCost: number;
  memoryUsage: number;
  cpuUsage: number;
  vectorStoreSize: number;
  activeConnections: number;
  recentActivity: ActivityEntry[];
  status: 'healthy' | 'degraded' | 'error';
}

export interface ActivityEntry {
  id: string;
  type: 'mission' | 'agent' | 'system' | 'auth';
  action: string;
  message: string;
  status: 'success' | 'running' | 'failed' | 'pending';
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface MissionStats {
  daily: number[];
  weekly: number[];
  monthly: number[];
  byStatus: { status: string; count: number }[];
}

// === Missions ===
export type MissionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Mission {
  id: string;
  name: string;
  description?: string;
  status: MissionStatus;
  agent: string;
  model: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  tokensUsed?: number;
  error?: string;
  steps: MissionStep[];
  output?: string;
}

export interface MissionStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  agent: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  input?: string;
  output?: string;
  error?: string;
}

// === API Keys ===
export interface ApiKey {
  id: string;
  name: string;
  key: string;
  maskedKey: string;
  organizationId: string;
  status: 'active' | 'revoked';
  createdAt: string;
  lastUsedAt?: string;
  rateLimit?: number;
  usageCount: number;
}

// === Search ===
export interface SearchResult {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  score: number;
  source?: string;
}

export interface SearchFilters {
  query: string;
  agent?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

// === Settings ===
export interface SystemSettings {
  llm: {
    provider: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  embedding: {
    provider: string;
    model: string;
    dimensions: number;
  };
  security: {
    encryptionEnabled: boolean;
    rateLimitingEnabled: boolean;
    sessionTimeout: number;
  };
  notifications: {
    enabled: boolean;
    webhookUrl?: string;
  };
  server: {
    port: number;
    corsOrigins: string;
    metricsEnabled: boolean;
  };
  auth: {
    disabled: boolean;
    jwtExpiry: string;
  };
}

// === API Response Types ===
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
}
