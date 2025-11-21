import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { noContentResponse, errorResponse } from '@/utils/response.util';
import { errorHandler } from '@/middlewares/error.middleware';
import { authMiddleware, getAuthenticatedUser } from '@/middlewares/auth.middleware';
import { corsMiddleware } from '@/middlewares/cors.middleware';
import { loggingMiddleware } from '@/middlewares/logging.middleware';
import { HTTP_STATUS } from '@/lib/constants';

/**
 * DELETE /api/users/wishlist/:courseId
 * Remove course from wishlist
 */
async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const user = getAuthenticatedUser(request);

    if (!user) {
      return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    const { courseId } = await params;

    // Check if exists in wishlist
    const wishlistItem = await prisma.wishlist.findUnique({
      where: {
        userId_courseId: {
          userId: user.userId,
          courseId,
        },
      },
    });

    if (!wishlistItem) {
      return errorResponse('Course not in wishlist', HTTP_STATUS.NOT_FOUND);
    }

    // Remove from wishlist
    await prisma.wishlist.delete({
      where: { id: wishlistItem.id },
    });

    return noContentResponse();
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
    }
    return errorResponse('Failed to remove from wishlist', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// Apply middlewares and export
async function authenticatedHandler(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  const authResult = await authMiddleware(request);
  if (authResult) return authResult;
  return handler(request, context);
}

// Properly typed export
export const DELETE = (request: NextRequest, context: { params: Promise<{ courseId: string }> }) =>
  errorHandler((req: NextRequest) =>
    loggingMiddleware((req2: NextRequest) =>
      corsMiddleware((req3: NextRequest) => authenticatedHandler(req3, context))(req2)
    )(req)
  )(request);
