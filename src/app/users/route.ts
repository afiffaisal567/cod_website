import { NextRequest } from "next/server";
import userService from "@/services/user.service";
import { registerSchema } from "@/lib/validation";
import {
  successResponse,
  paginatedResponse,
  validationErrorResponse,
  errorResponse,
} from "@/utils/response.util";
import { validateData, validatePagination } from "@/utils/validation.util";
import { errorHandler } from "@/middlewares/error.middleware";
import {
  authMiddleware,
  getAuthenticatedUser,
} from "@/middlewares/auth.middleware";
import { corsMiddleware } from "@/middlewares/cors.middleware";
import { loggingMiddleware } from "@/middlewares/logging.middleware";
import { HTTP_STATUS, USER_ROLES } from "@/lib/constants";
import type { UserRole, UserStatus } from "@prisma/client";

/**
 * GET /api/users
 * Get all users with pagination and filters
 */
async function getHandler(request: NextRequest) {
  try {
    // Get authenticated user
    const user = getAuthenticatedUser(request);

    if (!user) {
      return errorResponse("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    }

    // Only admin can view all users
    if (user.role !== USER_ROLES.ADMIN) {
      return errorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN);
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || undefined;
    const role = searchParams.get("role") as UserRole | undefined;
    const status = searchParams.get("status") as UserStatus | undefined;
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = (searchParams.get("sortOrder") || "desc") as
      | "asc"
      | "desc";

    // Validate pagination
    const validatedPagination = validatePagination(page, limit);

    // Get users
    const result = await userService.getAllUsers({
      page: validatedPagination.page,
      limit: validatedPagination.limit,
      search,
      role,
      status,
      sortBy,
      sortOrder,
    });

    return paginatedResponse(
      result.data,
      result.meta,
      "Users retrieved successfully"
    );
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
    }
    return errorResponse(
      "Failed to get users",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * POST /api/users
 * Create new user (admin only)
 */
async function postHandler(request: NextRequest) {
  try {
    // Get authenticated user
    const user = getAuthenticatedUser(request);

    if (!user) {
      return errorResponse("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    }

    // Only admin can create users
    if (user.role !== USER_ROLES.ADMIN) {
      return errorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN);
    }

    // Parse request body
    const body = await request.json();

    // Validate input
    const validation = await validateData(registerSchema, body);

    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    // Create user
    const newUser = await userService.createUser(validation.data);

    return successResponse(
      newUser,
      "User created successfully",
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
    }
    return errorResponse(
      "Failed to create user",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
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

export const GET = errorHandler(
  loggingMiddleware(corsMiddleware(authenticatedGetHandler))
);
export const POST = errorHandler(
  loggingMiddleware(corsMiddleware(authenticatedPostHandler))
);
