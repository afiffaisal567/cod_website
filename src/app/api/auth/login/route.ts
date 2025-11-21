import { NextRequest } from 'next/server';
import { loginSchema } from '@/lib/validation';
import authService from '@/services/auth.service';
import { successResponse, validationErrorResponse, errorResponse } from '@/utils/response.util';
import { validateData } from '@/utils/validation.util';
import { errorHandler } from '@/middlewares/error.middleware';
import { corsMiddleware } from '@/middlewares/cors.middleware';
import { loggingMiddleware } from '@/middlewares/logging.middleware';
import { rateLimit } from '@/middlewares/ratelimit.middleware';
import { HTTP_STATUS } from '@/lib/constants';

/**
 * POST /api/auth/login
 * Login user and return tokens
 */
async function handler(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input
    const validation = await validateData(loginSchema, body);

    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    // Login user
    const result = await authService.login(validation.data);

    return successResponse(result, 'Login successful');
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.UNAUTHORIZED);
    }
    return errorResponse('Login failed', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// Apply middlewares and export
export const POST = errorHandler(
  loggingMiddleware(
    corsMiddleware(
      rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 10, // 10 login attempts per 15 minutes
      })(handler)
    )
  )
);
