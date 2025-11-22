import { NextRequest } from "next/server";
import { changePasswordSchema } from "@/lib/validation";
import authService from "@/services/auth.service";
import {
  successResponse,
  validationErrorResponse,
  errorResponse,
} from "@/utils/response.util";
import { validateData } from "@/utils/validation.util";
import { errorHandler } from "@/middlewares/error.middleware";
import { requireAuth } from "@/middlewares/auth.middleware";
import { corsMiddleware } from "@/middlewares/cors.middleware";
import { loggingMiddleware } from "@/middlewares/logging.middleware";
import { HTTP_STATUS } from "@/lib/constants";

// Handler sekarang menerima parameter user
async function handler(
  request: NextRequest,
  user: { userId: string; email: string; role: string }
) {
  try {
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "Invalid JSON in request body",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Validate input
    const validation = await validateData(changePasswordSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    // Check if new password is different from current
    if (validation.data.currentPassword === validation.data.newPassword) {
      return errorResponse(
        "New password must be different from current password",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Change password
    await authService.changePassword(
      user.userId,
      validation.data.currentPassword,
      validation.data.newPassword
    );

    return successResponse(null, "Password changed successfully");
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
    }
    return errorResponse(
      "Failed to change password",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

// Gunakan requireAuth yang sudah diperbaiki
const authenticatedHandler = requireAuth(handler);

export const POST = errorHandler(
  loggingMiddleware(corsMiddleware(authenticatedHandler))
);
