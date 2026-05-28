import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger, httpLogger } from './utils/logger';
import { appErrorHandler as errorHandler, notFoundHandler } from './errors';
import { authMiddleware } from './middleware/auth';
import { metricsMiddleware, metricsHandler } from './middleware/metrics';
import { killPort } from './services/portService';
import prisma, { initDatabase } from './db';
import { shutdownQueues } from './jobs/queue';
import { createMissionWorker } from './jobs/missionWorker';
import missionsRouter from './routes/missions';
import settingsRouter from './routes/settings';
import previewRouter from './routes/preview';
import searchRouter from './routes/search';
import designRouter from './routes/design';
import authRouter from './routes/auth';
import statsRouter from './routes/stats';

const app = express();

// =============================================================================
// Security Middleware (order matters — security before everything else)
// =============================================================================

// 1. Security headers (helmet)
app.use(helmet({ contentSecurityPolicy: false }));

// 2. CORS
if (config.corsAllowAll) {
  app.use(cors());
  logger.warn('CORS allow all origins — only use in development');
} else {
  app.use(
    cors({
      origin: config.corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
      credentials: true,
      maxAge: 86400,
    }),
  );
  logger.info({ origins: config.corsOrigins }, 'CORS configured');
}

// 3. Request logging (pino-http — structured JSON HTTP logging)
app.use(
  pinoHttp({
    logger: httpLogger as unknown as pinoHttp.Options['logger'],
    autoLogging: {
      ignore: (req) => req.url === '/health',
    },
    quietReqLogger: true,
  }),
);

// 4. Metrics collection (captures request count, duration, errors)
app.use(metricsMiddleware);

// 5. Body parsing with size limits
app.use(express.json({ limit: config.maxBodySize }));
app.use(express.urlencoded({ extended: false, limit: config.maxBodySize }));

// 6. Rate limiting (skip health check — needs to be polled)
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  message: { error: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
});
app.use(limiter);

// 7. Authentication (all routes except health + metrics)
app.use(authMiddleware);

// =============================================================================
// Routes
// =============================================================================

// Health check — public, no auth required (auth + rate limiter skip /health)
app.get('/health', async (_req, res) => {
  // Check database connectivity
  let dbOk = false;
  let dbError: string | undefined;
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbOk = true;
  } catch (err: unknown) {
    dbError = err instanceof Error ? err.message : 'Unknown DB error';
  }

  const uptime = process.uptime();
  const statusCode = dbOk ? 200 : 503;

  res.status(statusCode).json({
    status: dbOk ? 'ok' : 'degraded',
    version: config.version,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    uptimeHuman: formatUptime(uptime),
    checks: {
      database: dbOk ? 'healthy' : `unhealthy: ${dbError}`,
    },
  });
});

// Metrics endpoint — Prometheus-compatible metrics
if (config.enableMetrics) {
  app.get('/metrics', metricsHandler);
}

app.use('/api/auth', authRouter);
app.use('/api/missions', missionsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/missions', previewRouter);
app.use('/api/search', searchRouter);
app.use('/api/design', designRouter);
app.use('/api/stats', statsRouter);

// =============================================================================
// Error Handling (must be last)
// =============================================================================

app.use(notFoundHandler);
app.use(errorHandler);

// =============================================================================
// Server Startup
// =============================================================================

// Kill any existing process on the port before starting
killPort(config.port);

// Initialize database, then start server
initDatabase()
  .then(() => {
    // Initialize BullMQ mission worker (processes jobs from the queue)
    const missionWorker = createMissionWorker();
    logger.info(
      { concurrency: config.jobs.concurrency, maxRetries: config.jobs.maxRetries },
      'Mission worker initialized',
    );

    const server = app.listen(config.port, () => {
      const mode = config.isProduction ? 'production' : 'development';

      logger.info(
        {
          port: config.port,
          mode,
          auth: 'multi-tenant (database-backed)',
          rateLimit: `${config.rateLimit.max}/15min`,
          metrics: config.enableMetrics ? '/metrics' : 'disabled',
          jobs: {
            concurrency: config.jobs.concurrency,
            backend: 'bullmq+redis',
          },
        },
        `AEGIS v${config.version} started — http://localhost:${config.port}/health`,
      );
    });

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutting down gracefully...');

      // Stop accepting new requests
      server.close(() => {
        logger.info('HTTP server closed');
      });

      // Close worker (stops processing new jobs, waits for active ones)
      await missionWorker.close();

      // Close queue connections
      await shutdownQueues();

      // Disconnect database
      await prisma.$disconnect();

      logger.info('Graceful shutdown complete');

      // Force exit — server.close() may not drain persistent connections (SSE, etc.)
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })
  .catch((err) => {
    logger.fatal({ err }, 'Failed to initialize database');
    process.exit(1);
  });

export default app;

// =============================================================================
// Helpers
// =============================================================================

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}
