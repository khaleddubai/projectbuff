/**
 * AEGIS — Structured Logger
 *
 * Uses pino for fast, structured JSON logging with environment-aware
 * formatting (pretty-print in development, JSON in production).
 */

import pino from 'pino';
import type { IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import fs from 'fs';

// Determine config from env
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');
const logDir = process.env.LOG_DIR || '';

// Ensure log directory exists if configured
let logFileStream: fs.WriteStream | undefined;
if (logDir) {
  const logPath = path.resolve(logDir);
  fs.mkdirSync(logPath, { recursive: true });
  const filePath = path.join(logPath, 'aegis.log');
  logFileStream = fs.createWriteStream(filePath, { flags: 'a' });
}

/**
 * Application-wide logger instance.
 *
 * - LOG_DIR set  → writes JSON to file (production-style)
 * - Development   → pretty-prints with colour to stdout
 * - Production    → outputs newline-delimited JSON to stdout
 */
export const logger = pino({
  level: logLevel,
  redact: {
    paths: ['req.headers.authorization', 'req.headers["x-api-key"]', 'apiKey', 'secret'],
    censor: '[REDACTED]',
  },
  serializers: {
    req: (req: IncomingMessage) => ({
      method: req.method,
      url: req.url,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
      },
    }),
    res: (res: ServerResponse) => ({
      statusCode: res.statusCode,
    }),
    err: pino.stdSerializers.err,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(logFileStream
    ? {}
    : !isProduction
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:HH:MM:ss.l',
              ignore: 'pid,hostname',
            },
          },
        }
      : {}),
}, logFileStream ?? pino.destination(1));

/**
 * Child logger with a named component context.
 *
 * Usage: const log = childLogger('http');   log.info('Server started');
 */
export function childLogger(name: string): ReturnType<typeof logger.child> {
  return logger.child({ component: name });
}

/**
 * Create a pino-http compatible logger instance for Express middleware.
 */
export const httpLogger = logger.child({ component: 'http' });
