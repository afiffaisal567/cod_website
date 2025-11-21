import { NextRequest } from "next/server";
import { resetPasswordSchema } from "@/lib/validation";
import authService from "@/services/auth.service";
import {
  successResponse,
  validationErrorResponse,
  errorResponse,
} from "@/utils/response.util";
import { validateData } from "@/utils/validation.util";
import { errorHandler } from "@/middlewares/error.middleware";
import { corsMiddleware } from "@/middlewares/cors.middleware";
import { loggingMiddleware } from "@/middlewares/logging.middleware";
import { rateLimit } from "@/middlewares/ratelimit.middleware";
import { HTTP_STATUS } from "@/lib/constants";

async function handler(request: NextRequest) {
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
    const validation = await validateData(resetPasswordSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    // Check token format
    if (!validation.data.token || validation.data.token.length < 16) {
      return errorResponse(
        "Invalid reset token format",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Reset password
    await authService.resetPassword(
      validation.data.token,
      validation.data.password
    );

    return successResponse(
      null,
      "Password has been reset successfully. You can now login with your new password."
    );
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
    }
    return errorResponse(
      "Failed to reset password",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export const POST = errorHandler(
  loggingMiddleware(
    corsMiddleware(
      rateLimit({
        windowMs: 15 * 60 * 1000,
        maxRequests: 5,
      })(handler)
    )
  )
);
