import { NextRequest } from "next/server";
import authService from "@/services/auth.service";
import { successResponse, errorResponse } from "@/utils/response.util";
import { errorHandler } from "@/middlewares/error.middleware";
import {
  authMiddleware,
  getAuthenticatedUser,
} from "@/middlewares/auth.middleware";
import { corsMiddleware } from "@/middlewares/cors.middleware";
import { loggingMiddleware } from "@/middlewares/logging.middleware";
import { HTTP_STATUS } from "@/lib/constants";

async function handler(request: NextRequest) {
  try {
    // Get authenticated user
    const user = getAuthenticatedUser(request);
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

async function authenticatedHandler(request: NextRequest) {
  const authResult = await authMiddleware(request);
  if (authResult) return authResult;
  return handler(request);
}

export const POST = errorHandler(
  loggingMiddleware(corsMiddleware(authenticatedHandler))
);
