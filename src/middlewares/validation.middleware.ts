import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema } from 'zod';
import { validateData } from '@/utils/validation.util';
import { validationErrorResponse } from '@/utils/response.util';

/**
 * Validation Middleware
 * Validates request body against Zod schema
 */
export function validateBody(
  schema: ZodSchema
): (
  handler: (request: NextRequest) => Promise<NextResponse>
) => (request: NextRequest) => Promise<NextResponse> {
  return (handler) => {
    return async (request: NextRequest) => {
      try {
        // Parse request body
        const body = await request.json();

        // Validate against schema
        const validation = await validateData(schema, body);

        if (!validation.success) {
          return validationErrorResponse(validation.errors);
        }

        // Attach validated data to request headers as JSON string
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-validated-body', JSON.stringify(validation.data));

        // Create new request with validated data
        const newRequest = new NextRequest(request.url, {
          method: request.method,
          headers: requestHeaders,
          body: JSON.stringify(validation.data),
        });

        return handler(newRequest);
      } catch {
        return validationErrorResponse(
          { body: ['Invalid JSON body'] },
          'Request body validation failed'
        );
      }
    };
  };
}

/**
 * Get validated body from request
 */
export function getValidatedBody<T = Record<string, unknown>>(request: NextRequest): T | null {
  const validatedBody = request.headers.get('x-validated-body');

  if (!validatedBody) {
    return null;
  }

  try {
    return JSON.parse(validatedBody) as T;
  } catch {
    return null;
  }
}

/**
 * Validate query parameters
 */
export function validateQuery(
  schema: ZodSchema
): (
  handler: (request: NextRequest) => Promise<NextResponse>
) => (request: NextRequest) => Promise<NextResponse> {
  return (handler) => {
    return async (request: NextRequest) => {
      try {
        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const queryObject: Record<string, string> = {};

        searchParams.forEach((value, key) => {
          queryObject[key] = value;
        });

        // Validate against schema
        const validation = await validateData(schema, queryObject);

        if (!validation.success) {
          return validationErrorResponse(validation.errors);
        }

        // Attach validated query to request headers
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-validated-query', JSON.stringify(validation.data));

        return handler(request);
      } catch {
        return validationErrorResponse(
          { query: ['Invalid query parameters'] },
          'Query validation failed'
        );
      }
    };
  };
}

/**
 * Get validated query from request
 */
export function getValidatedQuery<T = Record<string, unknown>>(request: NextRequest): T | null {
  const validatedQuery = request.headers.get('x-validated-query');

  if (!validatedQuery) {
    return null;
  }

  try {
    return JSON.parse(validatedQuery) as T;
  } catch {
    return null;
  }
}
