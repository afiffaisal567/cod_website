import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, extractTokenFromHeader } from '@/lib/auth';
import { unauthorizedResponse, forbiddenResponse } from '@/utils/response.util';
import { USER_STATUS } from '@/lib/constants';
import prisma from '@/lib/prisma';

// Extended NextRequest with user info
export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user info to request
 */
export async function authMiddleware(request: NextRequest): Promise<NextResponse | null> {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('Authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return unauthorizedResponse('No token provided');
    }

    // Verify token
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      return unauthorizedResponse(error instanceof Error ? error.message : 'Invalid token');
    }

    // Check if user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      return unauthorizedResponse('User not found');
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      return forbiddenResponse('User account is suspended or inactive');
    }

    // Attach user info to request headers (for Next.js App Router)
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', user.id);
    requestHeaders.set('x-user-email', user.email);
    requestHeaders.set('x-user-role', user.role);

    // Return null to continue to next middleware/handler
    return null;
  } catch (error) {
    console.error('Auth middleware error:', error);
    return unauthorizedResponse('Authentication failed');
  }
}

/**
 * Get authenticated user from request headers
 */
export function getAuthenticatedUser(request: NextRequest): {
  userId: string;
  email: string;
  role: string;
} | null {
  const userId = request.headers.get('x-user-id');
  const email = request.headers.get('x-user-email');
  const role = request.headers.get('x-user-role');

  if (!userId || !email || !role) {
    return null;
  }

  return { userId, email, role };
}

/**
 * Require authentication wrapper for API routes
 */
export function requireAuth(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const authResult = await authMiddleware(request);

    if (authResult) {
      // Auth failed, return error response
      return authResult;
    }

    // Auth successful, proceed to handler
    return handler(request);
  };
}
