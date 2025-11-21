import { NextRequest } from 'next/server';
import { registerSchema } from '@/lib/validation';
import authService from '@/services/auth.service';
import { successResponse, validationErrorResponse, errorResponse } from '@/utils/response.util';
import { validateData } from '@/utils/validation.util';
import { errorHandler } from '@/middlewares/error.middleware';
import { corsMiddleware } from '@/middlewares/cors.middleware';
import { loggingMiddleware } from '@/middlewares/logging.middleware';
import { rateLimit } from '@/middlewares/ratelimit.middleware';
import { HTTP_STATUS } from '@/lib/constants';

/**
 * POST /api/auth/register
 * Register new user
 */
async function handler(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input
    const validation = await validateData(registerSchema, body);

    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    // Register user
    const result = await authService.register(validation.data);

    return successResponse(
      result,
      'Registration successful. Please check your email to verify your account.',
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
    }
    return errorResponse('Registration failed', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// Apply middlewares and export
export const POST = errorHandler(
  loggingMiddleware(
    corsMiddleware(
      rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5, // 5 registrations per 15 minutes
      })(handler)
    )
  )
);