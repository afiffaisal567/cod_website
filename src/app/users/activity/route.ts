// ============================================
// PATH: src/app/api/users/activity/route.ts
// ============================================

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { paginatedResponse, errorResponse } from '@/utils/response.util';
import { validatePagination } from '@/utils/validation.util';
import { errorHandler } from '@/middlewares/error.middleware';
import { authMiddleware, getAuthenticatedUser } from '@/middlewares/auth.middleware';
import { corsMiddleware } from '@/middlewares/cors.middleware';
import { loggingMiddleware } from '@/middlewares/logging.middleware';
import { HTTP_STATUS } from '@/lib/constants';
import type { Prisma } from '@prisma/client';

/**
 * GET /api/users/activity
 * Get user activity history
 */
async function handler(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);

    if (!user) {
      return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const action = searchParams.get('action') || undefined;

    // Validate pagination
    const validatedPagination = validatePagination(page, limit);

    // Build where clause
    const where: Prisma.ActivityLogWhereInput = { userId: user.userId };
    if (action) {
      where.action = action;
    }

    // Get activity logs
    const skip = (validatedPagination.page - 1) * validatedPagination.limit;

    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip,
        take: validatedPagination.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return paginatedResponse(
      activities,
      {
        page: validatedPagination.page,
        limit: validatedPagination.limit,
        total,
      },
      'Activity history retrieved successfully'
    );
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
    }
    return errorResponse('Failed to get activity history', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// Apply middlewares and export
async function authenticatedHandler(request: NextRequest) {
  const authResult = await authMiddleware(request);
  if (authResult) return authResult;
  return handler(request);
}

export const GET = errorHandler(loggingMiddleware(corsMiddleware(authenticatedHandler)));
