import { NextRequest } from "next/server";
import authService from "@/services/auth.service";
import { successResponse, errorResponse } from "@/utils/response.util";
import { errorHandler } from "@/middlewares/error.middleware";
import { requireAuth } from "@/middlewares/auth.middleware";
import { corsMiddleware } from "@/middlewares/cors.middleware";
import { loggingMiddleware } from "@/middlewares/logging.middleware";
import { HTTP_STATUS } from "@/lib/constants";

// Handler dengan parameter yang sesuai
async function handler(request: NextRequest, context: any) {
  try {
    // Dapatkan user dari context yang sudah ditambahkan oleh requireAuth
    const user = context.user;

    if (!user) {
      return errorResponse("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    }

    console.log("🔍 Getting user data for:", user.userId);

    const userData = await authService.getCurrentUser(user.userId);

    if (!userData) {
      return errorResponse("User not found", HTTP_STATUS.NOT_FOUND);
    }

    return successResponse(userData, "User data retrieved successfully");
  } catch (error) {
    console.error("❌ Error in /api/auth/me:", error);
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
}

// Gunakan requireAuth untuk wrap handler
const authenticatedHandler = requireAuth(handler);

// Wrap dengan middleware
const wrappedHandler = corsMiddleware(authenticatedHandler);

export const GET = errorHandler(loggingMiddleware(wrappedHandler));
