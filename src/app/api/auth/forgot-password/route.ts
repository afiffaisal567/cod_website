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
    const validation = await validateData(forgotPasswordSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    // Request password reset
    await authService.requestPasswordReset(validation.data.email);

    // Always return success to prevent email enumeration
    return successResponse(
      null,
      "If an account exists with this email, you will receive password reset instructions."
    );
  } catch (error) {
    // Log the error but don't expose details
    console.error("Forgot password error:", error);
    return successResponse(
      null,
      "If an account exists with this email, you will receive password reset instructions."
    );
  }
}

export const POST = errorHandler(
  loggingMiddleware(
    corsMiddleware(
      rateLimit({
        windowMs: 15 * 60 * 1000,
        maxRequests: 3,
      })(handler)
    )
  )
);
