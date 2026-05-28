/**
 * AEGIS — Centralized Configuration
 *
 * All environment-derived configuration lives here, sourced from the
 * Zod-validated environment schema. This ensures every config value
 * has correct types and meaningful defaults.
 *
 * IMPORTANT: Importing this module triggers env validation on first load.
 * If required env vars are missing or invalid, the process will exit
 * with a clear error message.
 */

import { getEnv } from './env';

/** Validated environment object */
const env = getEnv();

export const config = {
  /** Port the API server listens on */
  port: env.PORT,

  /** Host to bind to */
  host: env.HOST,

  /** CORS — allowed origins for production */
  corsOrigins: env.CORS_ORIGINS.split(',')
    .map((s: string) => s.trim())
    .filter(Boolean),

  /** Whether CORS should allow all origins (development only) */
  corsAllowAll: env.CORS_ALLOW_ALL,

  /** Master API key for authenticating requests */
  masterApiKey: env.MASTER_API_KEY || '',

  /** Encryption key for at-rest secrets (must be at least 32 chars) */
  encryptionKey: env.ENCRYPTION_KEY,

  /** Rate limiting */
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
  },

  /** Request body size limit */
  maxBodySize: env.MAX_BODY_SIZE,

  /** Node environment */
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',

  /** Logging */
  logLevel: env.LOG_LEVEL,
  logDir: env.LOG_DIR || '',

  /** Whether to expose the /metrics endpoint */
  enableMetrics: env.ENABLE_METRICS,

  /** Application version (injected at build time) */
  version: env.APP_VERSION,

  /** Database connection string */
  databaseUrl: env.DATABASE_URL,

  /** Default LLM provider (nvidia | openrouter) */
  llmProvider: env.LLM_PROVIDER,

  /** NVIDIA LLM configuration */
  nvidia: {
    apiKey: env.NVIDIA_API_KEY || '',
    baseUrl: env.NVIDIA_BASE_URL,
    model: env.NVIDIA_MODEL,
  },

  /** OpenRouter LLM configuration */
  openrouter: {
    apiKey: env.OPENROUTER_API_KEY || '',
    model: env.OPENROUTER_MODEL,
    baseUrl: env.OPENROUTER_BASE_URL,
  },

  /** Embedding / RAG configuration */
  embedding: {
    model: env.EMBEDDING_MODEL,
    dimensions: env.EMBEDDING_DIMENSIONS,
  },

  /** Authentication */
  authDisabled: env.AUTH_DISABLED,

  /** Redis connection (BullMQ job queue backend) */
  redis: {
    url: env.REDIS_URL,
    prefix: env.REDIS_PREFIX,
  },

  /** BullMQ Job Queue configuration */
  jobs: {
    concurrency: env.JOB_CONCURRENCY,
    maxRetries: env.JOB_MAX_RETRIES,
    retryDelayMs: env.JOB_RETRY_DELAY_MS,
  },

  /** Output directory for generated projects */
  outputDir: env.AEGIS_OUTPUT_DIR || '',
} as const;
