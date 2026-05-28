/* =============================================
   AEGIS — API Client
   ============================================= */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options?: RequestInit & { timeout?: number }
): Promise<T> {
  const { timeout = 15000, ...fetchOptions } = options ?? {};
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new ApiError(
        body.error || `Request failed with status ${response.status}`,
        response.status,
        body.code
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Request timed out', 408);
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      0
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

// === Stats ===
export const stats = {
  get: () => request<Record<string, unknown>>('/api/stats'),
};

// === Missions ===
export const missions = {
  list: (params?: { status?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return request<Record<string, unknown>[]>(`/api/missions${query ? `?${query}` : ''}`);
  },
  get: (id: string) => request<Record<string, unknown>>(`/api/missions/${id}`),
  execute: (data: { idea: string }) =>
    request<Record<string, unknown>>('/api/missions', {
      method: 'POST',
      body: JSON.stringify({ idea: data.idea }),
    }),
  cancel: (id: string) =>
    request<Record<string, unknown>>(`/api/missions/${id}/cancel`, { method: 'POST' }),
};

// === API Keys ===
export const apiKeys = {
  list: async () => {
    const res = await request<{ keys: Record<string, unknown>[]; count: number }>('/api/auth/keys');
    // Transform backend response to the format expected by the component
    return (res.keys || []).map((key) => ({
      id: key.id,
      name: key.name,
      maskedKey: (key.keyPrefix as string) + '****',
      keyPrefix: key.keyPrefix,
      status: 'active',
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      usageCount: 0,
    }));
  },
  create: async (data: { name: string; expiresInDays?: number }) => {
    const res = await request<Record<string, unknown>>('/api/auth/keys', {
      method: 'POST',
      body: JSON.stringify({ name: data.name }),
    });
    // Transform to component format
    return {
      id: res.id,
      key: res.rawKey as string,
      name: res.name,
      maskedKey: (res.keyPrefix as string) + '****',
      status: 'active',
      createdAt: res.createdAt,
      warning: res.warning,
    };
  },
  revoke: (id: string) =>
    request<Record<string, unknown>>(`/api/auth/keys/${id}`, { method: 'DELETE' }),
};

// === Search ===
export const search = {
  query: (params: { q: string; limit?: number; agent?: string }) => {
    const qs = new URLSearchParams({ q: params.q });
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.agent) qs.set('agent', params.agent);
    return request<Record<string, unknown>[]>(`/api/search?${qs.toString()}`);
  },
};

// === Settings ===
export const settings = {
  get: () => request<Record<string, unknown>>('/api/settings'),
  update: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>('/api/settings/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// === Design ===
export const design = {
  generate: (data: { prompt: string }) =>
    request<Record<string, unknown>>('/api/design', {
      method: 'POST',
      body: JSON.stringify(data),
      timeout: 120000, // 2 min timeout for generation
    }),
};
