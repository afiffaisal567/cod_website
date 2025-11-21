import { NextRequest } from "next/server";
import { forgotPasswordSchema } from "@/lib/validation";
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
import { HTTP_STATUS } from "@/lib/constants";

/**
 * POST /api/auth/resend-verification
 * Resend email verification (No rate limit - handled by email service)
 */
async function handler(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input
    const validation = await validateData(forgotPasswordSchema, body);

    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    // Resend verification email
    await authService.resendVerificationEmail(validation.data.email);

    return successResponse(
      null,
      "Verification email has been sent. Please check your inbox."
    );
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
    }
    return errorResponse(
      "Failed to send verification email",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

// Apply middlewares without rate limit
export const POST = errorHandler(loggingMiddleware(corsMiddleware(handler)));
