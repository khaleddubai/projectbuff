/**
 * AEGIS — Environment Variable Validation
 *
 * Uses Zod to validate and parse all environment variables at startup.
 * Provides a single source of truth for configuration with runtime
 * validation, ensuring the server fails fast with clear error messages
 * when required vars are missing or invalid.
 */

import { z } from 'zod';
import { childLogger } from '../utils/logger';

const log = childLogger('env');

/**
 * Schema for all environment variables used by AEGIS.
 * Every env var accessed at runtime must be defined here.
 */
const envSchema = z.object({
  // ---- Server ----
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  HOST: z.string().default('0.0.0.0'),

  // ---- Database ----
  DATABASE_URL: z.string().url().default(
    'postgresql://aegis:aegis_secret@localhost:5432/aegis?schema=public',
  ),

  // ---- CORS ----
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),
  CORS_ALLOW_ALL: z
    .string()
    .optional()
    .transform((v) => v === 'true'),

  // ---- Authentication ----
  MASTER_API_KEY: z.string().optional(),
  AUTH_DISABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true'),

  // ---- Encryption ----
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters').default(
    'aegis-default-change-me-in-production!!',
  ),

  // ---- LLM Provider Selection ----
  LLM_PROVIDER: z.enum(['nvidia', 'openrouter']).default('openrouter'),

  // ---- NVIDIA LLM ----
  NVIDIA_API_KEY: z.string().optional(),
  NVIDIA_BASE_URL: z.string().url().default('https://integrate.api.nvidia.com/v1'),
  NVIDIA_MODEL: z.string().default('qwen/qwen3-coder-480b-a35b-instruct'),

  // ---- OpenRouter LLM ----
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('openrouter/free'),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),

  // ---- Embeddings ----
  EMBEDDING_MODEL: z.string().default('openai/text-embedding-3-small'),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),

  // ---- Rate Limiting ----
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

  // ---- Request Limits ----
  MAX_BODY_SIZE: z.string().default('10mb'),

  // ---- Logging ----
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  LOG_DIR: z.string().optional(),

  // ---- Metrics ----
  ENABLE_METRICS: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),

  // ---- Redis (BullMQ job queue) ----
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  REDIS_PREFIX: z.string().default('aegis'),

  // ---- BullMQ Job Queue ----
  JOB_CONCURRENCY: z.coerce.number().int().positive().max(10).default(3),
  JOB_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
  JOB_RETRY_DELAY_MS: z.coerce.number().int().positive().default(5000),

  // ---- Application ----
  APP_VERSION: z.string().default('1.0.0'),
  AEGIS_OUTPUT_DIR: z.string().optional(),

  // ---- PostgreSQL connection overrides (for docker-compose) ----
  PG_USER: z.string().default('aegis'),
  PG_PASSWORD: z.string().default('aegis_secret'),
  PG_DATABASE: z.string().default('aegis'),
  PG_PORT: z.coerce.number().int().positive().default(5432),
});

/** Type inferred from the validated env schema */
export type ValidatedEnv = z.infer<typeof envSchema>;

/**
 * Cache for the parsed environment so we only validate once.
 */
let _env: ValidatedEnv | null = null;

/**
 * Validate and return the parsed environment variables.
 * On first call, parses `process.env` through the Zod schema.
 * Subsequent calls return the cached result.
 *
 * Exits the process with an error message if validation fails.
 * This ensures the server never starts with misconfigured environment.
 */
export function getEnv(): ValidatedEnv {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message} (received: ${JSON.stringify(issue.received)})`,
    );

    log.fatal(
      { issueCount: issues.length },
      `\n❌ Environment variable validation failed:\n${issues.join('\n')}\n`,
    );

    // Print to stderr explicitly for Docker/CI visibility
    console.error('\n❌ Environment variable validation failed:');
    for (const issue of issues) {
      console.error(issue);
    }
    console.error();

    process.exit(1);
  }

  _env = result.data;
  return _env;
}

/**
 * Reset the cached env (useful for testing).
 */
export function resetEnv(): void {
  _env = null;
}

export default envSchema;
