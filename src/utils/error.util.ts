import { ZodError } from "zod";
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from "@prisma/client/runtime/library";
import { HTTP_STATUS, ERROR_MESSAGES } from "@/lib/constants";

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
  constructor(message: string = "Validation failed") {
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
  constructor(message: string = "Resource already exists") {
    super(message, HTTP_STATUS.CONFLICT);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "Too many requests") {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS);
  }
}

/**
 * Format Zod Validation Errors
 */
export function formatZodError(error: ZodError): Record<string, string[]> {
  const formattedErrors: Record<string, string[]> = {};

  error.issues.forEach((issue) => {
    const path = issue.path.join(".");
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
export function formatPrismaError(error: unknown): {
  message: string;
  statusCode: number;
} {
  // Check for Prisma known request errors
  if (error instanceof PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        // Unique constraint violation
        const field = (error.meta as any)?.target as string[];
        return {
          message: `${field?.[0] || "Field"} already exists`,
          statusCode: HTTP_STATUS.CONFLICT,
        };

      case "P2025":
        // Record not found
        return {
          message: ERROR_MESSAGES.NOT_FOUND,
          statusCode: HTTP_STATUS.NOT_FOUND,
        };

      case "P2003":
        // Foreign key constraint violation
        return {
          message: "Invalid reference to related record",
          statusCode: HTTP_STATUS.BAD_REQUEST,
        };

      case "P2014":
        // Invalid ID
        return {
          message: "Invalid ID provided",
          statusCode: HTTP_STATUS.BAD_REQUEST,
        };

      default:
        return {
          message: "Database operation failed",
          statusCode: HTTP_STATUS.BAD_REQUEST,
        };
    }
  }

  // Check for Prisma validation errors
  if (error instanceof PrismaClientValidationError) {
    return {
      message: "Invalid data provided",
      statusCode: HTTP_STATUS.BAD_REQUEST,
    };
  }

  // Handle generic errors
  if (error instanceof Error) {
    return {
      message: error.message,
      statusCode: HTTP_STATUS.BAD_REQUEST,
    };
  }

  // Unknown error
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

/**
 * Check if error is a database error
 */
export function isDatabaseError(error: unknown): boolean {
  return (
    error instanceof PrismaClientKnownRequestError ||
    error instanceof PrismaClientValidationError
  );
}

/**
 * Create error from unknown type
 */
export function createErrorFromUnknown(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new ValidationError("Validation failed");
  }

  if (isDatabaseError(error)) {
    const { message, statusCode } = formatPrismaError(error);
    return new AppError(message, statusCode);
  }

  if (error instanceof Error) {
    return new AppError(error.message);
  }

  return new AppError("An unexpected error occurred");
}
