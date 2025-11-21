import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { paginatedResponse, errorResponse } from '@/utils/response.util';
import { validatePagination } from '@/utils/validation.util';
import { errorHandler } from '@/middlewares/error.middleware';
import { authMiddleware, getAuthenticatedUser } from '@/middlewares/auth.middleware';
import { corsMiddleware } from '@/middlewares/cors.middleware';
import { loggingMiddleware } from '@/middlewares/logging.middleware';
import { HTTP_STATUS } from '@/lib/constants';
import type { TransactionStatus, Prisma } from '@prisma/client';

/**
 * GET /api/users/transactions
 * Get user transaction history with pagination
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
    const status = searchParams.get('status') as TransactionStatus | undefined;

    // Validate pagination
    const validatedPagination = validatePagination(page, limit);

    // Build where clause
    const where: Prisma.TransactionWhereInput = { userId: user.userId };
    if (status) {
      where.status = status;
    }

    // Calculate skip
    const skip = (validatedPagination.page - 1) * validatedPagination.limit;

    // Get transactions
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: validatedPagination.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderId: true,
          amount: true,
          discount: true,
          totalAmount: true,
          paymentMethod: true,
          status: true,
          paidAt: true,
          expiredAt: true,
          createdAt: true,
          course: {
            select: {
              id: true,
              title: true,
              thumbnail: true,
            },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    return paginatedResponse(
      transactions,
      {
        page: validatedPagination.page,
        limit: validatedPagination.limit,
        total,
      },
      'Transactions retrieved successfully'
    );
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
    }
    return errorResponse('Failed to get transactions', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// Apply middlewares and export
async function authenticatedHandler(request: NextRequest) {
  const authResult = await authMiddleware(request);
  if (authResult) return authResult;
  return handler(request);
}

export const GET = errorHandler(loggingMiddleware(corsMiddleware(authenticatedHandler)));
