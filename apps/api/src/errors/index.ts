/**
 * AEGIS — Typed HTTP Errors
 *
 * Structured error classes that map HTTP status codes to typed
 * application errors. Provides consistent error responses across
 * the entire API with machine-readable codes and optional details.
 */

import { childLogger } from '../utils/logger';

const log = childLogger('errors');

/**
 * Base application error with HTTP status code and machine-readable code.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Serialize the error to a JSON-compatible response object.
   */
  toJSON() {
    return {
      error: this.message,
      code: this.code,
      status: this.statusCode,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

// =============================================================================
// 4xx Client Errors
// =============================================================================

/** 400 Bad Request — invalid input, malformed payload */
export class BadRequestError extends AppError {
  constructor(
    message: string = 'Bad request',
    details?: Record<string, unknown>,
  ) {
    super(message, 400, 'BAD_REQUEST', details);
    this.name = 'BadRequestError';
  }
}

/** 401 Unauthorized — missing or invalid credentials */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Missing or invalid authentication') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

/** 403 Forbidden — authenticated but not permitted */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

/** 404 Not Found — resource does not exist */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/** 409 Conflict — resource state conflict (e.g. duplicate) */
export class ConflictError extends AppError {
  constructor(
    message: string = 'Resource conflict',
    details?: Record<string, unknown>,
  ) {
    super(message, 409, 'CONFLICT', details);
    this.name = 'ConflictError';
  }
}

/** 422 Unprocessable Entity — validation failure */
export class ValidationError extends AppError {
  public readonly issues: { path: string; message: string }[];

  constructor(
    message: string = 'Validation failed',
    issues: { path: string; message: string }[] = [],
  ) {
    super(message, 422, 'VALIDATION_ERROR', { issues });
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

/** 429 Too Many Requests — rate limit exceeded */
export class RateLimitError extends AppError {
  constructor(
    message: string = 'Too many requests, please try again later',
    retryAfterMs?: number,
  ) {
    super(message, 429, 'RATE_LIMITED', retryAfterMs ? { retryAfterMs } : undefined);
    this.name = 'RateLimitError';
  }
}

// =============================================================================
// 5xx Server Errors
// =============================================================================

/** 500 Internal Server Error — unexpected failure */
export class InternalError extends AppError {
  constructor(
    message: string = 'Internal server error',
    details?: Record<string, unknown>,
  ) {
    super(message, 500, 'INTERNAL_ERROR', details);
    this.name = 'InternalError';
  }
}

/** 502 Bad Gateway — upstream service failure */
export class BadGatewayError extends AppError {
  constructor(
    message: string = 'Upstream service unavailable',
    details?: Record<string, unknown>,
  ) {
    super(message, 502, 'BAD_GATEWAY', details);
    this.name = 'BadGatewayError';
  }
}

/** 503 Service Unavailable — temporary outage / maintenance */
export class ServiceUnavailableError extends AppError {
  constructor(
    message: string = 'Service temporarily unavailable',
    details?: Record<string, unknown>,
  ) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details);
    this.name = 'ServiceUnavailableError';
  }
}

// =============================================================================
// Utility — Express-Compatible Error Handler
// =============================================================================

import type { Request, Response, NextFunction } from 'express';

/**
 * Global Express error handler middleware.
 * Catches all errors (both AppError instances and unexpected errors)
 * and returns a consistent JSON response.
 */
export function appErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Known application error — return structured response
  if (err instanceof AppError) {
    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  // Zod validation errors from middleware
  if (err.name === 'ZodError') {
    const zodErr = err as { issues?: { path: (string | number)[]; message: string }[] };
    const issues = (zodErr.issues || []).map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(422).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      status: 422,
      details: { issues },
    });
    return;
  }

  // Unknown / unexpected error — log and return generic message
  log.error(
    {
      err: {
        message: err.message,
        stack: err.stack?.split('\n').slice(0, 4).join('\n'),
        name: err.name,
      },
    },
    'Unhandled error',
  );

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    status: 500,
  });
}

/**
 * 404 catch-all handler for unknown routes.
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not found',
    code: 'NOT_FOUND',
    status: 404,
  });
}
