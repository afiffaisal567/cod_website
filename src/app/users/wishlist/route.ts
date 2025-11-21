import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successResponse, paginatedResponse, errorResponse } from '@/utils/response.util';
import { validatePagination } from '@/utils/validation.util';
import { errorHandler } from '@/middlewares/error.middleware';
import { authMiddleware, getAuthenticatedUser } from '@/middlewares/auth.middleware';
import { corsMiddleware } from '@/middlewares/cors.middleware';
import { loggingMiddleware } from '@/middlewares/logging.middleware';
import { HTTP_STATUS } from '@/lib/constants';

/**
 * GET /api/users/wishlist
 * Get user wishlist
 */
async function getHandler(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);

    if (!user) {
      return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Validate pagination
    const validatedPagination = validatePagination(page, limit);

    // Calculate skip
    const skip = (validatedPagination.page - 1) * validatedPagination.limit;

    // Get wishlist
    const [wishlist, total] = await Promise.all([
      prisma.wishlist.findMany({
        where: { userId: user.userId },
        skip,
        take: validatedPagination.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              thumbnail: true,
              shortDescription: true,
              level: true,
              price: true,
              discountPrice: true,
              isFree: true,
              averageRating: true,
              totalStudents: true,
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
        },
      }),
      prisma.wishlist.count({ where: { userId: user.userId } }),
    ]);

    return paginatedResponse(
      wishlist,
      {
        page: validatedPagination.page,
        limit: validatedPagination.limit,
        total,
      },
      'Wishlist retrieved successfully'
    );
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
    }
    return errorResponse('Failed to get wishlist', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * POST /api/users/wishlist
 * Add course to wishlist
 */
async function postHandler(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);

    if (!user) {
      return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    // Parse request body
    const body = await request.json();
    const { courseId } = body;

    if (!courseId) {
      return errorResponse('Course ID is required', HTTP_STATUS.BAD_REQUEST);
    }

    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      return errorResponse('Course not found', HTTP_STATUS.NOT_FOUND);
    }

    // Check if already in wishlist
    const existingWishlist = await prisma.wishlist.findUnique({
      where: {
        userId_courseId: {
          userId: user.userId,
          courseId,
        },
      },
    });

    if (existingWishlist) {
      return errorResponse('Course already in wishlist', HTTP_STATUS.CONFLICT);
    }

    // Check if already enrolled
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.userId,
          courseId,
        },
      },
    });

    if (enrollment) {
      return errorResponse('You are already enrolled in this course', HTTP_STATUS.CONFLICT);
    }

    // Add to wishlist
    const wishlistItem = await prisma.wishlist.create({
      data: {
        userId: user.userId,
        courseId,
      },
      select: {
        id: true,
        createdAt: true,
        course: {
          select: {
            id: true,
            title: true,
            thumbnail: true,
            price: true,
          },
        },
      },
    });

    return successResponse(wishlistItem, 'Course added to wishlist', HTTP_STATUS.CREATED);
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
    }
    return errorResponse('Failed to add to wishlist', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// Apply middlewares and export
async function authenticatedGetHandler(request: NextRequest) {
  const authResult = await authMiddleware(request);
  if (authResult) return authResult;
  return getHandler(request);
}

async function authenticatedPostHandler(request: NextRequest) {
  const authResult = await authMiddleware(request);
  if (authResult) return authResult;
  return postHandler(request);
}

export const GET = errorHandler(loggingMiddleware(corsMiddleware(authenticatedGetHandler)));
export const POST = errorHandler(loggingMiddleware(corsMiddleware(authenticatedPostHandler)));
