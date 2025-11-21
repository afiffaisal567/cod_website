import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ERROR_MESSAGES, HTTP_STATUS } from '@/lib/constants';

// Custom Error Classes
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = HTTP_STATUS.BAD_REQUEST) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed') {
    super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = ERROR_MESSAGES.UNAUTHORIZED) {
    super(message, HTTP_STATUS.UNAUTHORIZED);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = ERROR_MESSAGES.FORBIDDEN) {
    super(message, HTTP_STATUS.FORBIDDEN);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = ERROR_MESSAGES.NOT_FOUND) {
    super(message, HTTP_STATUS.NOT_FOUND);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, HTTP_STATUS.CONFLICT);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = ERROR_MESSAGES.RATE_LIMIT_EXCEEDED) {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS);
  }
}

/**
 * Format Zod Validation Errors
 */
export function formatZodError(error: ZodError): Record<string, string[]> {
  const formattedErrors: Record<string, string[]> = {};

  error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    if (!formattedErrors[path]) {
      formattedErrors[path] = [];
    }
    formattedErrors[path].push(issue.message);
  });

  return formattedErrors;
}

/**
 * Format Prisma Errors
 */
export function formatPrismaError(error: unknown): { message: string; statusCode: number } {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        const field = error.meta?.target as string[];
        return {
          message: `${field?.[0] || 'Field'} already exists`,
          statusCode: HTTP_STATUS.CONFLICT,
        };

      case 'P2025':
        // Record not found
        return {
          message: ERROR_MESSAGES.NOT_FOUND,
          statusCode: HTTP_STATUS.NOT_FOUND,
        };

      case 'P2003':
        // Foreign key constraint violation
        return {
          message: 'Invalid reference to related record',
          statusCode: HTTP_STATUS.BAD_REQUEST,
        };

      case 'P2014':
        // Invalid ID
        return {
          message: 'Invalid ID provided',
          statusCode: HTTP_STATUS.BAD_REQUEST,
        };

      default:
        return {
          message: 'Database operation failed',
          statusCode: HTTP_STATUS.BAD_REQUEST,
        };
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      message: 'Invalid data provided',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    };
  }

  return {
    message: ERROR_MESSAGES.INTERNAL_ERROR,
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  };
}

/**
 * Check if error is operational (safe to send to client)
 */
export function isOperationalError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Safe error message for client
 */
export function getSafeErrorMessage(error: unknown): string {
  if (isOperationalError(error)) {
    return (error as AppError).message;
  }

  // Don't expose internal errors to client
  return ERROR_MESSAGES.INTERNAL_ERROR;
}
