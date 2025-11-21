import { NextRequest, NextResponse } from 'next/server';
import { AppError, formatPrismaError, formatZodError } from '@/utils/error.util';
import {
  errorResponse,
  internalErrorResponse,
  validationErrorResponse,
} from '@/utils/response.util';
import { logError } from '@/utils/logger.util';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

/**
 * Global Error Handler Middleware
 */
export function errorHandler(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    try {
      return await handler(request);
    } catch (error) {
      return handleError(error);
    }
  };
}

/**
 * Handle different types of errors
 */
function handleError(error: unknown): NextResponse {
  // Log error
  logError('API Error', error);

  // Handle AppError (operational errors)
  if (error instanceof AppError) {
    return errorResponse(error.message, error.statusCode);
  }

  // Handle Zod Validation Errors
  if (error instanceof ZodError) {
    return validationErrorResponse(formatZodError(error), 'Validation failed');
  }

  // Handle Prisma Errors
  if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientValidationError
  ) {
    const { message, statusCode } = formatPrismaError(error);
    return errorResponse(message, statusCode);
  }

  // Handle generic errors
  if (error instanceof Error) {
    // Don't expose internal error messages in production
    const message =
      process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred';

    return internalErrorResponse(message);
  }

  // Unknown error
  return internalErrorResponse('An unexpected error occurred');
}

/**
 * Async error wrapper for API routes
 */
export function asyncHandler<T = Record<string, unknown>>(
  handler: (request: NextRequest, context?: T) => Promise<NextResponse>
): (request: NextRequest, context?: T) => Promise<NextResponse> {
  return async (request: NextRequest, context?: T) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleError(error);
    }
  };
}

/**
 * Try-catch wrapper with custom error handling
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  errorHandler?: (error: unknown) => T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (errorHandler) {
      return errorHandler(error);
    }
    throw error;
  }
}
