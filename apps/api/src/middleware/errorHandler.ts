/**
 * AEGIS — Error Handler Middleware (Legacy Re-export)
 *
 * This module re-exports from the centralized errors module for
 * backward compatibility. All new code should import directly from
 * '../errors' instead.
 */

export {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  InternalError,
  BadGatewayError,
  ServiceUnavailableError,
  appErrorHandler as errorHandler,
  notFoundHandler,
} from '../errors';
