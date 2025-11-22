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

    // Perform logout
    await authService.logout(user.userId);

    return successResponse(
      { message: "Please remove tokens from client storage" },
      "Logout successful"
    );
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
    }
    return errorResponse("Logout failed", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// Gunakan requireAuth untuk wrap handler
const authenticatedHandler = requireAuth(handler);

// Wrap dengan middleware
const wrappedHandler = corsMiddleware(authenticatedHandler);

export const POST = errorHandler(loggingMiddleware(wrappedHandler));
