import { NextResponse } from 'next/server';
import { HTTP_STATUS } from '@/lib/constants';

// Standard API Response Interface
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  timestamp: string;
}

/**
 * Success Response
 */
export function successResponse<T>(
  data: T,
  message: string = 'Success',
  statusCode: number = HTTP_STATUS.OK
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}

/**
 * Success Response with Pagination
 */
export function paginatedResponse<T>(
  data: T[],
  meta: {
    page: number;
    limit: number;
    total: number;
  },
  message: string = 'Success'
): NextResponse<ApiResponse<T[]>> {
  const totalPages = Math.ceil(meta.total / meta.limit);

  return NextResponse.json(
    {
      success: true,
      message,
      data,
      meta: {
        ...meta,
        totalPages,
      },
      timestamp: new Date().toISOString(),
    },
    { status: HTTP_STATUS.OK }
  );
}

/**
 * Created Response (201)
 */
export function createdResponse<T>(
  data: T,
  message: string = 'Created successfully'
): NextResponse<ApiResponse<T>> {
  return successResponse(data, message, HTTP_STATUS.CREATED);
}

/**
 * No Content Response (204)
 */
export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: HTTP_STATUS.NO_CONTENT });
}

/**
 * Error Response
 */
export function errorResponse(
  message: string,
  statusCode: number = HTTP_STATUS.BAD_REQUEST,
  error?: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      message,
      error,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}

/**
 * Validation Error Response (422)
 */
export function validationErrorResponse(
  errors: Record<string, string[]>,
  message: string = 'Validation failed'
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString(),
    },
    { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
  );
}

/**
 * Unauthorized Response (401)
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return errorResponse(message, HTTP_STATUS.UNAUTHORIZED);
}

/**
 * Forbidden Response (403)
 */
export function forbiddenResponse(message: string = 'Forbidden'): NextResponse {
  return errorResponse(message, HTTP_STATUS.FORBIDDEN);
}

/**
 * Not Found Response (404)
 */
export function notFoundResponse(message: string = 'Not found'): NextResponse {
  return errorResponse(message, HTTP_STATUS.NOT_FOUND);
}

/**
 * Conflict Response (409)
 */
export function conflictResponse(message: string = 'Conflict'): NextResponse {
  return errorResponse(message, HTTP_STATUS.CONFLICT);
}

/**
 * Internal Server Error Response (500)
 */
export function internalErrorResponse(
  message: string = 'Internal server error',
  error?: string
): NextResponse {
  return errorResponse(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, error);
}

/**
 * Rate Limit Response (429)
 */
export function rateLimitResponse(message: string = 'Too many requests'): NextResponse {
  return errorResponse(message, HTTP_STATUS.TOO_MANY_REQUESTS);
}
