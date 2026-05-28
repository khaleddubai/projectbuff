/**
 * AEGIS — BullMQ Job Queue Configuration
 *
 * Defines the Redis-backed job queue for async mission processing.
 * BullMQ provides:
 *  - Persistent job storage (jobs survive server restarts)
 *  - Built-in retry with exponential backoff
 *  - Job scheduling, delays, and rate limiting
 *  - Real-time event tracking (active, completed, failed, progress)
 *  - Concurrency control
 */

import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';
import { childLogger } from '../utils/logger';

const log = childLogger('queue');

// =============================================================================
// Redis Connection
// =============================================================================

/** Shared Redis connection for BullMQ (reuses connection across queue + worker) */
export const redisConnection = new Redis(config.redis.url, {
  maxRetriesPerRequest: null, // BullMQ manages retries internally
  enableReadyCheck: false,    // BullMQ handles readiness
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 500, 5000);
    log.warn({ attempt: times, delayMs: delay }, 'Redis connection retry');
    return delay;
  },
  lazyConnect: false,
});

redisConnection.on('connect', () => log.info('Redis connected'));
redisConnection.on('error', (err) => log.warn({ err: err.message }, 'Redis connection error'));
redisConnection.on('ready', () => log.info('Redis ready for BullMQ'));
redisConnection.on('close', () => log.warn('Redis connection closed'));

// =============================================================================
// Job Type Definitions
// =============================================================================

/** Data payload for a mission execution job */
export interface MissionJobData {
  projectId: string;
  idea: string;
  orgId: string;
  submittedAt: string;
}

/** Result produced when a mission job completes */
export interface MissionJobResult {
  projectId: string;
  success: boolean;
  status: 'completed' | 'failed';
  outputPath?: string;
  error?: string;
  durationMs: number;
  agentCount: number;
  totalTokens?: number;
}

/** All possible job types in the AEGIS system */
export type JobType = 'mission:execute';

// =============================================================================
// Queues
// =============================================================================

/**
 * Default job options for mission execution jobs.
 * - Retries: configured max tries with exponential backoff
 * - Remove on complete after 100 jobs to prevent unbounded memory growth
 */
const defaultJobOptions = {
  attempts: config.jobs.maxRetries + 1, // First attempt + retries
  backoff: {
    type: 'exponential' as const,
    delay: config.jobs.retryDelayMs,
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
};

/**
 * Mission Queue — processes mission execution jobs.
 * Jobs are submitted when a user creates a new mission.
 */
export const missionQueue = new Queue<MissionJobData, MissionJobResult>('missions', {
  connection: redisConnection,
  defaultJobOptions,
  prefix: config.redis.prefix,
});

// =============================================================================
// Queue Events (logging)
// =============================================================================

missionQueue.on('waiting', (jobId) => {
  log.debug({ jobId }, 'Job waiting for processing');
});

missionQueue.on('active', (job) => {
  log.info({ jobId: job.id, projectId: job.data.projectId }, 'Job started processing');
});

missionQueue.on('completed', (job) => {
  const result = job.returnvalue;
  log.info(
    {
      jobId: job.id,
      projectId: job.data.projectId,
      durationMs: result?.durationMs,
      status: result?.status,
    },
    'Job completed successfully',
  );
});

missionQueue.on('failed', (job, err) => {
  log.error(
    {
      jobId: job?.id,
      projectId: job?.data?.projectId,
      attempt: job?.attemptsMade,
      err: err.message,
    },
    'Job failed',
  );
});

missionQueue.on('progress', (job, progress) => {
  log.debug({ jobId: job.id, projectId: job.data.projectId, progress }, 'Job progress update');
});

// =============================================================================
// Graceful Shutdown
// =============================================================================

/**
 * Close all queue connections gracefully.
 * Call during server shutdown.
 */
export async function shutdownQueues(): Promise<void> {
  log.info('Shutting down queues...');

  await missionQueue.close();
  await redisConnection.quit();

  log.info('Queues shut down');
}

/**
 * Get queue metrics (for dashboard / monitoring).
 */
export async function getQueueMetrics() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    missionQueue.getWaitingCount(),
    missionQueue.getActiveCount(),
    missionQueue.getCompletedCount(),
    missionQueue.getFailedCount(),
    missionQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}
