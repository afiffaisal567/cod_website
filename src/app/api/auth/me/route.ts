import { NextRequest } from "next/server";
import authService from "@/services/auth.service";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/utils/response.util";
import { errorHandler } from "@/middlewares/error.middleware";
import {
  authMiddleware,
  getAuthenticatedUser,
} from "@/middlewares/auth.middleware";
import { corsMiddleware } from "@/middlewares/cors.middleware";
import { loggingMiddleware } from "@/middlewares/logging.middleware";
import { HTTP_STATUS } from "@/lib/constants";

/**
 * GET /api/auth/me
 * Get current authenticated user data
 */
async function handler(request: NextRequest) {
  try {
    // ✅ FIX: Proper error handling with null check
    const user = getAuthenticatedUser(request);

    if (!user) {
      return unauthorizedResponse("User not authenticated");
    }

    // ✅ FIX: Handle case when user not found in database
    try {
      const userData = await authService.getCurrentUser(user.userId);

      if (!userData) {
        return errorResponse("User not found", HTTP_STATUS.NOT_FOUND);
      }

      return successResponse(userData, "User data retrieved successfully");
    } catch (error) {
      // ✅ FIX: Better error handling
      if (error instanceof Error) {
        if (error.message === "User not found") {
          return errorResponse(error.message, HTTP_STATUS.NOT_FOUND);
        }
        return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
      }
      return errorResponse(
        "Failed to get user data",
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  } catch (error) {
    console.error("Unexpected error in /api/auth/me:", error);
    return errorResponse(
      "Internal server error",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

// Apply middlewares and export
async function authenticatedHandler(request: NextRequest) {
  const authResult = await authMiddleware(request);
  if (authResult) return authResult;
  return handler(request);
}

export const GET = errorHandler(
  loggingMiddleware(corsMiddleware(authenticatedHandler))
);
