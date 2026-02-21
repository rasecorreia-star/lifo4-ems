/**
 * Custom error classes for the EMS API
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, 'INTERNAL_ERROR');
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

// Error codes for specific scenarios
export const ErrorCodes = {
  // Authentication
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TWO_FACTOR_REQUIRED: 'TWO_FACTOR_REQUIRED',
  TWO_FACTOR_INVALID: 'TWO_FACTOR_INVALID',

  // Authorization
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ORGANIZATION_ACCESS_DENIED: 'ORGANIZATION_ACCESS_DENIED',

  // Resources
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  SYSTEM_NOT_FOUND: 'SYSTEM_NOT_FOUND',
  SITE_NOT_FOUND: 'SITE_NOT_FOUND',
  ORGANIZATION_NOT_FOUND: 'ORGANIZATION_NOT_FOUND',

  // System operations
  SYSTEM_OFFLINE: 'SYSTEM_OFFLINE',
  COMMAND_FAILED: 'COMMAND_FAILED',
  PROTECTION_TRIGGERED: 'PROTECTION_TRIGGERED',

  // Data
  INVALID_TELEMETRY: 'INVALID_TELEMETRY',
  DATA_NOT_AVAILABLE: 'DATA_NOT_AVAILABLE',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
