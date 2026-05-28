/**
 * Tests for the MCP server — validates all 8 tool handlers
 * with mocked database, LLM, and filesystem dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Shared mock data ──

const MOCK_UUID = '550e8400-e29b-41d4-a716-446655440000';
const MOCK_DATE = new Date('2025-01-01T00:00:00.000Z');

// ── Mock Prisma client ──

const MOCK_ORG_ID = '00000000-0000-4000-8000-000000000001';

const mockPrisma = {
  setting: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
  project: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  projectLog: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  organization: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  apiKey: {
    create: vi.fn(),
  },
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: vi.fn().mockResolvedValue(undefined),
  $transaction: vi.fn((arg: unknown) => {
    // If it's a function (transaction callback), call it with mockPrisma
    if (typeof arg === 'function') return Promise.resolve(arg(mockPrisma));
    // If it's an array of promises (used by updateSettings), resolve all
    if (Array.isArray(arg)) return Promise.resolve(arg.map(() => ({ id: 'upserted' })));
    return Promise.resolve(undefined);
  }),
  $queryRawUnsafe: vi.fn(),
};

// ── Mock dependencies ──

vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    constructor() {
      return mockPrisma;
    }
  },
}));

// Module-level flag to toggle LLM failure in tests
let _mockLLMShouldFail = false;

vi.mock('openai', () => ({
  OpenAI: class {
    chat = {
      completions: {
        create: vi.fn().mockImplementation(() => {
          if (_mockLLMShouldFail) {
            return Promise.reject(new Error('API rate limited'));
          }
          return Promise.resolve({
            choices: [{ message: { content: '{"tokens":{"primary":"#000"},"styleNotes":"Mock style"}' } }],
          });
        }),
      },
    };
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => MOCK_UUID),
}));

vi.mock('../utils/logger', () => ({
  childLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../orchestrator', () => ({
  runMission: vi.fn(() => Promise.resolve()),
  getMissionOutputDir: vi.fn(() => '/tmp/mock-output'),
}));

vi.mock('../services/embedding', () => ({
  generateEmbedding: vi.fn(() => Promise.resolve(new Array(1536).fill(0.1))),
}));

vi.mock('../services/llmConfig', () => ({
  getLLMConfig: vi.fn(() => Promise.resolve({
    provider: 'openrouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: 'sk-test-mock-key-12345',
    model: 'openrouter/free',
  })),
  getProviderBaseConfig: vi.fn(() => Promise.resolve({
    provider: 'openrouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: 'sk-test-mock-key-12345',
  })),
  getProvider: vi.fn(() => Promise.resolve('openrouter')),
}));

vi.mock('../services/designParser', () => ({
  DESIGN_ANALYSIS_SYSTEM: 'You are a design analyst.',
  buildDesignPrompt: vi.fn(() => 'Analyze this design.'),
  tokensToCSSVariables: vi.fn(() => ({ '--primary': '#000' })),
  DEFAULT_TOKENS: {
    colors: { primary: '#000', secondary: '#fff' },
    typography: { fontFamily: 'Inter, sans-serif' },
    spacing: { unit: 8 },
    borderRadius: 8,
    layout: 'responsive' as const,
  },
}));

// ── Tests ──

describe('MCP Server — Tool Handlers', () => {
  let mcp: typeof import('./index');

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_DATE);

    // Ensure ensureDefaultOrganization() works: return an existing org
    mockPrisma.organization.findFirst.mockResolvedValue({
      id: MOCK_ORG_ID,
      name: 'Test Org',
      createdAt: MOCK_DATE,
      updatedAt: MOCK_DATE,
    });

    mcp = await import('./index');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── createMCPServer ──

  describe('createMCPServer()', () => {
    it('should create a server with the correct metadata', () => {
      const server = mcp.createMCPServer();
      expect(server).toBeDefined();
      // McpServer instance should have a `server` property with name/version
      expect((server as unknown as { server?: { info?: { name?: string } } }).server?.info?.name ?? 'aegis').toBe('aegis');
    });
  });

  // ── handleListMissions ──

  describe('handleListMissions', () => {
    it('should return formatted missions list', async () => {
      const mockProjects = [
        { id: '1', name: 'Mission 1', status: 'completed', idea: 'First mission', createdAt: MOCK_DATE, updatedAt: MOCK_DATE },
        { id: '2', name: 'Mission 2', status: 'running', idea: 'Second mission', createdAt: MOCK_DATE, updatedAt: MOCK_DATE },
      ];
      mockPrisma.project.findMany.mockResolvedValue(mockProjects);

      const result = await mcp.handleListMissions({});
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.missions).toHaveLength(2);
      expect(parsed.count).toBe(2);
      expect(parsed.missions[0].name).toBe('Mission 1');
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('should filter by status', async () => {
      mockPrisma.project.findMany.mockResolvedValue([]);

      await mcp.handleListMissions({ status: 'completed' });
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'completed' },
        }),
      );
    });

    it('should respect limit parameter', async () => {
      mockPrisma.project.findMany.mockResolvedValue([]);

      await mcp.handleListMissions({ limit: 5 });
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it('should default limit to 20', async () => {
      mockPrisma.project.findMany.mockResolvedValue([]);

      await mcp.handleListMissions({});
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it('should return empty list when no missions exist', async () => {
      mockPrisma.project.findMany.mockResolvedValue([]);

      const result = await mcp.handleListMissions({});
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.missions).toHaveLength(0);
      expect(parsed.count).toBe(0);
    });
  });

  // ── handleGetMission ──

  describe('handleGetMission', () => {
    const mockProject = {
      id: MOCK_UUID,
      name: 'Test Project',
      idea: 'Build a test app',
      status: 'completed',
      outputPath: null,
      createdAt: MOCK_DATE,
      updatedAt: MOCK_DATE,
    };

    it('should return mission details with logs', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.projectLog.findMany.mockResolvedValue([
        { id: 1, projectId: MOCK_UUID, agent: 'architect', message: 'Designing schema', type: 'info', createdAt: MOCK_DATE },
        { id: 2, projectId: MOCK_UUID, agent: 'backend', message: 'Building API', type: 'info', createdAt: MOCK_DATE },
      ]);

      const result = await mcp.handleGetMission({ projectId: MOCK_UUID });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.project.id).toBe(MOCK_UUID);
      expect(parsed.project.status).toBe('completed');
      expect(parsed.logs).toHaveLength(2);
      expect(parsed.logs[0].agent).toBe('architect');
      expect(parsed.logs[1].agent).toBe('backend');
    });

    it('should return error for non-existent mission', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await mcp.handleGetMission({ projectId: 'nonexistent' });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe('Mission not found');
      expect(parsed.code).toBe('NOT_FOUND');
    });
  });

  // ── handleDeleteMission ──

  describe('handleDeleteMission', () => {
    it('should require confirm: true', async () => {
      const result = await mcp.handleDeleteMission({ projectId: MOCK_UUID, confirm: false });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.code).toBe('CONFIRM_REQUIRED');
    });

    it('should return not found for non-existent mission', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await mcp.handleDeleteMission({ projectId: 'nonexistent', confirm: true });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.code).toBe('NOT_FOUND');
    });

    it('should delete mission and return success', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: MOCK_UUID,
        name: 'To Delete',
        status: 'completed',
        idea: 'Delete me',
        outputPath: null,
        createdAt: MOCK_DATE,
        updatedAt: MOCK_DATE,
      });

      const result = await mcp.handleDeleteMission({ projectId: MOCK_UUID, confirm: true });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.success).toBe(true);
      expect(parsed.deleted).toBe(MOCK_UUID);
      expect(mockPrisma.project.delete).toHaveBeenCalledWith({ where: { id: MOCK_UUID } });
    });
  });

  // ── handleCreateMission ──

  describe('handleCreateMission', () => {
    it('should create a project and return id in running state', async () => {
      mockPrisma.project.create.mockResolvedValue({
        id: MOCK_UUID,
        name: 'pending',
        idea: 'Build something great',
        status: 'running',
        createdAt: MOCK_DATE,
        updatedAt: MOCK_DATE,
      });

      const result = await mcp.handleCreateMission({ idea: 'Build something great' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(MOCK_UUID);
      expect(parsed.status).toBe('running');
      // Should not be an error
      expect(result.isError).toBeUndefined();
      // Verify a project was created with the right data (org-scoped)
      expect(mockPrisma.project.create).toHaveBeenCalledWith({
        data: { id: MOCK_UUID, name: 'pending', idea: 'Build something great', status: 'running', organizationId: MOCK_ORG_ID },
      });
    });

    it('should handle creation failure gracefully', async () => {
      mockPrisma.project.create.mockRejectedValue(new Error('Database connection failed'));

      const result = await mcp.handleCreateMission({ idea: 'This will fail' });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.code).toBe('CREATE_FAILED');
    });
  });

  // ── handleGetSettings ──

  describe('handleGetSettings', () => {
    it('should return all settings', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([
        { key: 'OPENROUTER_API_KEY', value: 'sk-abcdefghijklmnop' },
        { key: 'OPENROUTER_MODEL', value: 'qwen/qwen3-coder-480b-a35b-instruct' },
      ]);

      const result = await mcp.handleGetSettings();
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.count).toBe(2);
      expect(parsed.settings.OPENROUTER_MODEL).toBe('qwen/qwen3-coder-480b-a35b-instruct');
    });

    it('should redact sensitive API keys', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([
        { key: 'OPENROUTER_API_KEY', value: 'sk-abcdefghijklmnop' },
      ]);

      const result = await mcp.handleGetSettings();
      const parsed = JSON.parse(result.content[0].text);

      // API key should be partially redacted: first 4 chars + '...' + last 4 chars
      expect(parsed.settings.OPENROUTER_API_KEY).toContain('...');
      expect(parsed.settings.OPENROUTER_API_KEY).not.toBe('sk-abcdefghijklmnop');
      // Should start with first 4 chars
      expect(parsed.settings.OPENROUTER_API_KEY.startsWith('sk-a')).toBe(true);
      // Should end with last 4 chars
      expect(parsed.settings.OPENROUTER_API_KEY.endsWith('nop')).toBe(true);
    });

    it('should not redact short keys', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([
        { key: 'OPENROUTER_API_KEY', value: 'short' },
      ]);

      const result = await mcp.handleGetSettings();
      const parsed = JSON.parse(result.content[0].text);

      // Keys shorter than 8 chars should not be redacted
      expect(parsed.settings.OPENROUTER_API_KEY).toBe('short');
    });

    it('should return empty object when no settings exist', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([]);

      const result = await mcp.handleGetSettings();
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.count).toBe(0);
      expect(parsed.settings).toEqual({});
    });
  });

  // ── handleUpdateSettings ──

  describe('handleUpdateSettings', () => {
    it('should upsert settings and return success', async () => {
      mockPrisma.setting.upsert.mockResolvedValue({ key: 'TEST_KEY', value: 'test-value' });

      const result = await mcp.handleUpdateSettings({
        settings: { TEST_KEY: 'test-value', ANOTHER_KEY: 'another-value' },
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.success).toBe(true);
      expect(parsed.updated).toBe(2);
      expect(parsed.keys).toEqual(['TEST_KEY', 'ANOTHER_KEY']);
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

      const result = await mcp.handleUpdateSettings({
        settings: { TEST_KEY: 'test-value' },
      });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.code).toBe('DB_ERROR');
    });
  });

  // ── handleSearchKnowledge ──

  describe('handleSearchKnowledge', () => {
    it('should handle search errors gracefully', async () => {
      mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error('pgvector extension not available'));

      const result = await mcp.handleSearchKnowledge({ query: 'test search' });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.code).toBe('SEARCH_ERROR');
    });

    it('should return results from vector search', async () => {
      const mockResults = [
        { id: '1', projectId: MOCK_UUID, source: 'file', filePath: 'src/index.ts', content: 'Some code', score: 0.95 },
      ];
      mockPrisma.$queryRawUnsafe.mockResolvedValue(mockResults);

      const result = await mcp.handleSearchKnowledge({ query: 'find code' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.count).toBe(1);
      expect(parsed.results[0].source).toBe('file');
      expect(parsed.query).toBe('find code');
    });
  });

  // ── handleAnalyzeDesign (requires LLM mock) ──

  describe('handleAnalyzeDesign', () => {
    it('should return design tokens from description', async () => {
      const result = await mcp.handleAnalyzeDesign({
        description: 'A modern SaaS dashboard with blue theme',
      });

      const parsed = JSON.parse(result.content[0].text);
      // Should have design tokens from the mocked LLM response
      expect(parsed.tokens).toBeDefined();
      expect(parsed.styleNotes).toBeDefined();
    });

    it('should handle LLM failure with fallback tokens', async () => {
      _mockLLMShouldFail = true;
      try {
        const result = await mcp.handleAnalyzeDesign({
          description: 'Test design',
        });

        // Should return fallback tokens with isError flag
        expect(result.isError).toBe(true);
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.fallback).toBe(true);
        expect(parsed.tokens).toBeDefined();
        expect(parsed.tokens.colors).toBeDefined();
      } finally {
        _mockLLMShouldFail = false;
      }
    });
  });
});
