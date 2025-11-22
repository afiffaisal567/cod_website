import { NextRequest } from "next/server";
import { resendVerificationSchema } from "@/lib/validation"; // PERBAIKI IMPORT
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

    // Validate input - GUNAKAN SCHEMA YANG BENAR
    const validation = await validateData(resendVerificationSchema, body);
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

export const POST = errorHandler(
  loggingMiddleware(
    corsMiddleware(
      rateLimit({
        windowMs: 15 * 60 * 1000,
        maxRequests: 10,
      })(handler)
    )
  )
);
