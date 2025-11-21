import { NextRequest } from 'next/server';
import { verifyEmailSchema } from '@/lib/validation';
import authService from '@/services/auth.service';
import { successResponse, validationErrorResponse, errorResponse } from '@/utils/response.util';
import { validateData } from '@/utils/validation.util';
import { errorHandler } from '@/middlewares/error.middleware';
import { corsMiddleware } from '@/middlewares/cors.middleware';
import { loggingMiddleware } from '@/middlewares/logging.middleware';
import { HTTP_STATUS } from '@/lib/constants';

/**
 * POST /api/auth/verify-email
 * Verify email address using verification token
 */
async function handler(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input
    const validation = await validateData(verifyEmailSchema, body);

    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    // Verify email
    await authService.verifyEmail(validation.data.token);

    return successResponse(null, 'Email verified successfully. You can now access all features.');
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
    }
    return errorResponse('Failed to verify email', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// Apply middlewares and export
export const POST = errorHandler(loggingMiddleware(corsMiddleware(handler)));
