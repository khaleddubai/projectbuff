import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Build the mock Prisma client instance.
// Must include all models used by initDatabase → ensureDefaultOrganization.
const mockPrisma = {
  setting: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    upsert: vi.fn(),
  },
  project: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
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
  $transaction: vi.fn((cb: ((p: typeof mockPrisma) => Promise<unknown>) | undefined) => Promise.resolve(cb ? cb(mockPrisma) : undefined)),
  $queryRawUnsafe: vi.fn(),
};

// Use a class so `new PrismaClient()` works as a constructor
vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    constructor() {
      return mockPrisma;
    }
  },
}));

describe('Database initialization', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the cached defaultOrganizationId so ensureDefaultOrganization() re-runs
    const { resetDefaultOrganization } = await import('./middleware/auth');
    resetDefaultOrganization();
  });

  afterEach(async () => {
    const { shutdownDatabase } = await import('./db');
    await shutdownDatabase().catch(() => {});
  });

  it('should connect to the database on init', async () => {
    const { initDatabase } = await import('./db');
    // ensureDefaultOrganization needs mocks
    mockPrisma.organization.findFirst.mockResolvedValue({
      id: 'test-org', name: 'Test Org', createdAt: new Date(), updatedAt: new Date(),
    });
    await initDatabase();
    expect(mockPrisma.$connect).toHaveBeenCalledTimes(1);
  });

  it('should seed default settings when settings table is empty', async () => {
    const { initDatabase } = await import('./db');
    const originalKey = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    // No existing org → ensureDefaultOrganization will create one
    mockPrisma.organization.findFirst.mockResolvedValue(null);
    mockPrisma.organization.create.mockResolvedValue({
      id: 'test-org-id',
      name: 'Default Organization',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.apiKey.create.mockResolvedValue({ id: 'test-key-id' });
    mockPrisma.setting.createMany.mockResolvedValue({ count: 3 });

    await initDatabase();

    expect(mockPrisma.organization.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.apiKey.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.setting.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ key: 'OPENROUTER_API_KEY' }),
        expect.objectContaining({ key: 'OPENROUTER_MODEL' }),
        expect.objectContaining({ key: 'OPENROUTER_BASE_URL' }),
      ]),
    });

    process.env.OPENROUTER_API_KEY = originalKey;
  });

  it('should not seed settings when they already exist', async () => {
    const { initDatabase } = await import('./db');
    // Return an existing org so ensureDefaultOrganization doesn't create new ones
    mockPrisma.organization.findFirst.mockResolvedValue({
      id: 'existing-org',
      name: 'Existing Org',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await initDatabase();

    expect(mockPrisma.organization.create).not.toHaveBeenCalled();
    expect(mockPrisma.setting.createMany).not.toHaveBeenCalled();
  });

  it('should read settings from env vars when seeding', async () => {
    const { initDatabase } = await import('./db');
    const originalKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'sk-test-key';

    mockPrisma.organization.findFirst.mockResolvedValue(null);
    mockPrisma.organization.create.mockResolvedValue({
      id: 'test-org-id',
      name: 'Default Organization',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.apiKey.create.mockResolvedValue({ id: 'test-key-id' });
    mockPrisma.setting.createMany.mockResolvedValue({ count: 3 });

    await initDatabase();

    expect(mockPrisma.setting.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ key: 'OPENROUTER_API_KEY', value: 'sk-test-key' }),
      ]),
    });

    process.env.OPENROUTER_API_KEY = originalKey;
  });

  it('should disconnect on shutdown', async () => {
    const { initDatabase, shutdownDatabase } = await import('./db');

    await initDatabase();
    await shutdownDatabase();

    expect(mockPrisma.$disconnect).toHaveBeenCalledTimes(1);
  });
});

describe('Default export Prisma client', () => {
  it('should be the singleton PrismaClient instance', async () => {
    const { default: prisma } = await import('./db');

    expect(prisma.setting).toBe(mockPrisma.setting);
    expect(prisma.project).toBe(mockPrisma.project);
    expect(prisma.projectLog).toBe(mockPrisma.projectLog);
  });
});
