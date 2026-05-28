import { PrismaClient } from '@prisma/client';
import { childLogger } from './utils/logger';
import { ensureDefaultOrganization } from './middleware/auth';

const log = childLogger('db');

const prisma = new PrismaClient();

/**
 * Initialize the database connection and seed the default organization
 * with an admin API key and default settings.
 * Called once during server startup.
 */
export async function initDatabase(): Promise<void> {
  try {
    // Verify connection
    await prisma.$connect();
    log.info('Database connected');

    // Ensure at least one organization exists (creates default org + admin key + settings)
    const orgId = await ensureDefaultOrganization();
    log.info({ orgId }, 'Default organization ready');

    log.info('Database initialized');
  } catch (err) {
    log.error({ err }, 'Failed to initialize database');
    throw err;
  }
}

/**
 * Gracefully disconnect from the database.
 */
export async function shutdownDatabase(): Promise<void> {
  await prisma.$disconnect();
  log.info('Database disconnected');
}

export default prisma;
