import { NextRequest } from 'next/server';
import authService from '@/services/auth.service';
import { successResponse, errorResponse } from '@/utils/response.util';
import { errorHandler } from '@/middlewares/error.middleware';
import { corsMiddleware } from '@/middlewares/cors.middleware';
import { loggingMiddleware } from '@/middlewares/logging.middleware';
import { rateLimit } from '@/middlewares/ratelimit.middleware';
import { HTTP_STATUS } from '@/lib/constants';

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
async function handler(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return errorResponse('Refresh token is required', HTTP_STATUS.BAD_REQUEST);
    }

    // Refresh tokens
    const tokens = await authService.refreshToken(refreshToken);

    return successResponse(tokens, 'Token refreshed successfully');
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.UNAUTHORIZED);
    }
    return errorResponse('Token refresh failed', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// Apply middlewares and export
export const POST = errorHandler(
  loggingMiddleware(
    corsMiddleware(
      rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 20, // 20 refresh attempts per 15 minutes
      })(handler)
    )
  )
);
