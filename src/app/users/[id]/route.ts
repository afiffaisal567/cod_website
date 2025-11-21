import { NextRequest } from "next/server";
import userService from "@/services/user.service";
import { updateProfileSchema } from "@/lib/validation";
import {
  successResponse,
  validationErrorResponse,
  errorResponse,
  noContentResponse,
} from "@/utils/response.util";
import { validateData } from "@/utils/validation.util";
import {
  authMiddleware,
  getAuthenticatedUser,
} from "@/middlewares/auth.middleware";
import { HTTP_STATUS, USER_ROLES } from "@/lib/constants";

/**
 * GET /api/users/:id
 * Get user by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check
    const authResult = await authMiddleware(request);
    if (authResult) return authResult;

    const user = getAuthenticatedUser(request);
    if (!user) {
      return errorResponse("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    }

    const { id: targetUserId } = await params;

    // Users can view their own profile, admins can view any profile
    if (user.userId !== targetUserId && user.role !== USER_ROLES.ADMIN) {
      return errorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN);
    }

    // Get user
    const userData = await userService.getUserById(targetUserId);

    return successResponse(userData, "User retrieved successfully");
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.NOT_FOUND);
    }
    return errorResponse(
      "Failed to get user",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * PUT /api/users/:id
 * Update user by ID
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check
    const authResult = await authMiddleware(request);
    if (authResult) return authResult;

    const user = getAuthenticatedUser(request);
    if (!user) {
      return errorResponse("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    }

    const { id: targetUserId } = await params;

    // Users can update their own profile, admins can update any profile
    if (user.userId !== targetUserId && user.role !== USER_ROLES.ADMIN) {
      return errorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN);
    }

    // Parse request body
    const body = await request.json();

    // Validate input
    const validation = await validateData(updateProfileSchema, body);

    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    // Update user
    const updatedUser = await userService.updateUser(
      targetUserId,
      validation.data
    );

    return successResponse(updatedUser, "User updated successfully");
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
    }
    return errorResponse(
      "Failed to update user",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * DELETE /api/users/:id
 * Delete user by ID (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check
    const authResult = await authMiddleware(request);
    if (authResult) return authResult;

    const user = getAuthenticatedUser(request);
    if (!user) {
      return errorResponse("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    }

    // Only admin can delete users
    if (user.role !== USER_ROLES.ADMIN) {
      return errorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN);
    }

    const { id: targetUserId } = await params;

    // Prevent self-deletion
    if (user.userId === targetUserId) {
      return errorResponse(
        "Cannot delete your own account",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Delete user (soft delete)
    await userService.deleteUser(targetUserId);

    return noContentResponse();
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
    }
    return errorResponse(
      "Failed to delete user",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
