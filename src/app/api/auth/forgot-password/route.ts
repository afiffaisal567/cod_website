import { NextRequest } from 'next/server';
import { forgotPasswordSchema } from '@/lib/validation';
import authService from '@/services/auth.service';
import { successResponse, validationErrorResponse, errorResponse } from '@/utils/response.util';
import { validateData } from '@/utils/validation.util';
import { errorHandler } from '@/middlewares/error.middleware';
import { corsMiddleware } from '@/middlewares/cors.middleware';
import { loggingMiddleware } from '@/middlewares/logging.middleware';
import { rateLimit } from '@/middlewares/ratelimit.middleware';
import { HTTP_STATUS } from '@/lib/constants';

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
async function handler(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input
    const validation = await validateData(forgotPasswordSchema, body);

    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    // Request password reset
    await authService.requestPasswordReset(validation.data.email);

    // Always return success (don't reveal if email exists)
    return successResponse(
      null,
      'If an account exists with this email, you will receive password reset instructions.'
    );
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
    }
    return errorResponse('Failed to process request', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// Apply middlewares and export
export const POST = errorHandler(
  loggingMiddleware(
    corsMiddleware(
      rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 3, // 3 requests per 15 minutes
      })(handler)
    )
  )
);
