import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { paginatedResponse, errorResponse } from '@/utils/response.util';
import { validatePagination } from '@/utils/validation.util';
import { errorHandler } from '@/middlewares/error.middleware';
import { authMiddleware, getAuthenticatedUser } from '@/middlewares/auth.middleware';
import { corsMiddleware } from '@/middlewares/cors.middleware';
import { loggingMiddleware } from '@/middlewares/logging.middleware';
import { HTTP_STATUS } from '@/lib/constants';
import type { EnrollmentStatus, Prisma } from '@prisma/client';

/**
 * GET /api/users/enrollments
 * Get user enrolled courses with progress
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
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status') as EnrollmentStatus | undefined;

    // Validate pagination
    const validatedPagination = validatePagination(page, limit);

    // Build where clause
    const where: Prisma.EnrollmentWhereInput = { userId: user.userId };
    if (status) {
      where.status = status;
    }

    // Calculate skip
    const skip = (validatedPagination.page - 1) * validatedPagination.limit;

    // Get enrollments
    const [enrollments, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,
        skip,
        take: validatedPagination.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          progress: true,
          completedAt: true,
          lastAccessedAt: true,
          createdAt: true,
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              thumbnail: true,
              level: true,
              totalDuration: true,
              totalLectures: true,
              mentor: {
                select: {
                  user: {
                    select: {
                      name: true,
                      profilePicture: true,
                    },
                  },
                },
              },
            },
          },
          certificate: {
            select: {
              id: true,
              certificateNumber: true,
              issuedAt: true,
            },
          },
        },
      }),
      prisma.enrollment.count({ where }),
    ]);

    return paginatedResponse(
      enrollments,
      {
        page: validatedPagination.page,
        limit: validatedPagination.limit,
        total,
      },
      'Enrollments retrieved successfully'
    );
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
    }
    return errorResponse('Failed to get enrollments', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// Apply middlewares and export
async function authenticatedHandler(request: NextRequest) {
  const authResult = await authMiddleware(request);
  if (authResult) return authResult;
  return handler(request);
}

export const GET = errorHandler(loggingMiddleware(corsMiddleware(authenticatedHandler)));
