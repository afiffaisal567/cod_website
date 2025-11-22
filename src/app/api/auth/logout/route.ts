// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import authService from "@/services/auth.service";
import { successResponse, errorResponse } from "@/utils/response.util";
import { errorHandler } from "@/middlewares/error.middleware";
import { requireAuth } from "@/middlewares/auth.middleware";
import { corsMiddleware } from "@/middlewares/cors.middleware";
import { loggingMiddleware } from "@/middlewares/logging.middleware";
import { HTTP_STATUS } from "@/lib/constants";

// Handler yang menerima user dari requireAuth
async function handler(
  request: NextRequest,
  user: { userId: string; email: string; role: string }
) {
  try {
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

export const POST = errorHandler(
  loggingMiddleware(corsMiddleware(authenticatedHandler))
);
