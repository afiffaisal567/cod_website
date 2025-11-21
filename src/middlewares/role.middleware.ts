import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from './auth.middleware';
import { forbiddenResponse } from '@/utils/response.util';
import { USER_ROLES } from '@/lib/constants';

/**
 * Role-based Access Control Middleware
 */
export function requireRole(
  allowedRoles: string[]
): (
  handler: (request: NextRequest) => Promise<NextResponse>
) => (request: NextRequest) => Promise<NextResponse> {
  return (handler) => {
    return async (request: NextRequest) => {
      // Get authenticated user
      const user = getAuthenticatedUser(request);

      if (!user) {
        return forbiddenResponse('Authentication required');
      }

      // Check if user has required role
      if (!allowedRoles.includes(user.role)) {
        return forbiddenResponse('Insufficient permissions');
      }

      // User has required role, proceed to handler
      return handler(request);
    };
  };
}

/**
 * Require Admin role
 */
export function requireAdmin(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return requireRole([USER_ROLES.ADMIN])(handler);
}

/**
 * Require Mentor role
 */
export function requireMentor(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return requireRole([USER_ROLES.MENTOR, USER_ROLES.ADMIN])(handler);
}

/**
 * Require Student role (any authenticated user)
 */
export function requireStudent(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return requireRole([USER_ROLES.STUDENT, USER_ROLES.MENTOR, USER_ROLES.ADMIN])(handler);
}

/**
 * Check if user is owner of resource
 */
export async function isResourceOwner(
  request: NextRequest,
  resourceUserId: string
): Promise<boolean> {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return false;
  }

  // Admin can access any resource
  if (user.role === USER_ROLES.ADMIN) {
    return true;
  }

  // Check if user is the owner
  return user.userId === resourceUserId;
}

/**
 * Require resource ownership or admin
 */
export function requireOwnership(
  getResourceUserId: (request: NextRequest) => Promise<string | null>
): (
  handler: (request: NextRequest) => Promise<NextResponse>
) => (request: NextRequest) => Promise<NextResponse> {
  return (handler) => {
    return async (request: NextRequest) => {
      const user = getAuthenticatedUser(request);

      if (!user) {
        return forbiddenResponse('Authentication required');
      }

      // Admin can access any resource
      if (user.role === USER_ROLES.ADMIN) {
        return handler(request);
      }

      // Get resource owner ID
      const resourceUserId = await getResourceUserId(request);

      if (!resourceUserId) {
        return forbiddenResponse('Resource not found');
      }

      // Check ownership
      if (user.userId !== resourceUserId) {
        return forbiddenResponse('You do not have permission to access this resource');
      }

      return handler(request);
    };
  };
}
