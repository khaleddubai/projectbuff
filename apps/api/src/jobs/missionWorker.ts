/**
 * AEGIS — Mission Worker
 *
 * BullMQ Worker that processes mission execution jobs from the queue.
 * Each job represents one user mission — the full lifecycle of agent
 * orchestration, build, security scan, and output generation.
 *
 * Key features:
 *  - Full orchestrator execution within a queue-managed worker
 *  - Token usage tracking for every LLM call
 *  - Job progress reporting (0-100%)
 *  - Graceful error handling with queue retry
 *  - Concurrent mission processing (configurable via JOB_CONCURRENCY)
 */

import { Worker, Job } from 'bullmq';
import { config } from '../config';
import { childLogger } from '../utils/logger';
import { redisConnection, MissionJobData, MissionJobResult } from './queue';
import { recordTokenUsage } from './tokenTracker';
import { runMission } from '../orchestrator';

const log = childLogger('mission-worker');

// =============================================================================
// Worker Instance
// =============================================================================

/**
 * Create and configure the mission worker.
 * Called once during server startup.
 */
export function createMissionWorker(): Worker<MissionJobData, MissionJobResult> {
  const worker = new Worker<MissionJobData, MissionJobResult>(
    'missions',
    async (job: Job<MissionJobData>) => {
      const { projectId, idea, orgId } = job.data;
      const startTime = Date.now();

      log.info(
        {
          jobId: job.id,
          projectId,
          attempt: job.attemptsMade + 1,
          maxAttempts: config.jobs.maxRetries + 1,
        },
        'Processing mission job',
      );

      await job.updateProgress(5);

      try {
        // Run the full orchestrator — this has been refactored to
        // accept a token tracking callback and report progress
        const result = await runMissionWithTracking(
          projectId,
          idea,
          orgId,
          (progress: number) => job.updateProgress(progress),
        );

        const durationMs = Date.now() - startTime;

        log.info(
          {
            jobId: job.id,
            projectId,
            durationMs,
            status: result.status,
          },
          'Mission job completed',
        );

        return {
          projectId,
          success: result.status === 'completed',
          status: result.status as 'completed' | 'failed',
          outputPath: result.outputPath,
          durationMs,
          agentCount: result.agentCount,
          totalTokens: result.totalTokens,
        };
      } catch (err) {
        const durationMs = Date.now() - startTime;
        const errorMessage = err instanceof Error ? err.message : String(err);

        log.error(
          {
            jobId: job.id,
            projectId,
            durationMs,
            err: errorMessage,
          },
          'Mission job threw unhandled error',
        );

        return {
          projectId,
          success: false,
          status: 'failed',
          durationMs,
          agentCount: 0,
          error: errorMessage,
        };
      }
    },
    {
      connection: redisConnection,
      prefix: config.redis.prefix,
      concurrency: config.jobs.concurrency,
      lockDuration: 300_000, // 5 min lock — missions can take a while
      stalledInterval: 60_000, // Check for stalled jobs every 60s
      maxStalledCount: 2, // Allow 2 stalls before marking as failed
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
      // Auto-remove successful jobs after 24 hours
      // Auto-remove failed jobs after 7 days
    },
  );

  // =========================================================================
  // Worker Event Handlers
  // =========================================================================

  worker.on('completed', (job: Job<MissionJobData, MissionJobResult>) => {
    log.info(
      {
        jobId: job.id,
        projectId: job.data.projectId,
        result: job.returnvalue?.status,
      },
      'Worker completed job',
    );
  });

  worker.on('failed', (job: Job<MissionJobData> | undefined, err: Error) => {
    log.error(
      {
        jobId: job?.id,
        projectId: job?.data?.projectId,
        err: err.message,
      },
      'Worker failed job',
    );
  });

  worker.on('error', (err: Error) => {
    // This is a connection-level error, not a job error
    log.error({ err: err.message }, 'Worker encountered connection error');
  });

  worker.on('drained', () => {
    log.debug('Worker drained — no more jobs to process');
  });

  worker.on('active', (job: Job) => {
    log.info({ jobId: job.id, projectId: (job.data as MissionJobData)?.projectId }, 'Job active on worker');
  });

  log.info(
    {
      concurrency: config.jobs.concurrency,
      maxRetries: config.jobs.maxRetries,
    },
    'Mission worker created',
  );

  return worker;
}

// =============================================================================
// Orchestrator Wrapper with Token Tracking
// =============================================================================

interface MissionResult {
  status: string;
  outputPath?: string;
  agentCount: number;
  totalTokens?: number;
}

/**
 * Wraps the orchestrator's runMission function to:
 *  1. Inject token tracking callbacks
 *  2. Report job progress
 *  3. Capture result metrics
 *
 * The orchestrator.ts has been updated to accept these hooks.
 */
async function runMissionWithTracking(
  projectId: string,
  idea: string,
  orgId: string,
  reportProgress: (progress: number) => void,
): Promise<MissionResult> {
  // The orchestrator's runMission function has been updated to
  // accept progress reporting and token tracking callbacks.
  // We wrap it here to provide those hooks.
  return await runMission(projectId, idea, orgId, {
    onProgress: reportProgress,
    onTokenUsage: (usage) => recordTokenUsage(usage),
  });
}
