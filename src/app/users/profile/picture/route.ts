import { NextRequest } from "next/server";
import uploadService from "@/services/upload.service";
import userService from "@/services/user.service";
import {
  successResponse,
  errorResponse,
  noContentResponse,
} from "@/utils/response.util";
import { errorHandler } from "@/middlewares/error.middleware";
import {
  authMiddleware,
  getAuthenticatedUser,
} from "@/middlewares/auth.middleware";
import { corsMiddleware } from "@/middlewares/cors.middleware";
import { loggingMiddleware } from "@/middlewares/logging.middleware";
import { HTTP_STATUS } from "@/lib/constants";
import authService from "@/services/auth.service";

/**
 * PUT /api/users/profile/picture
 * Upload profile picture
 */
async function putHandler(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);

    if (!user) {
      return errorResponse("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    }

    // Get file from form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return errorResponse("No file provided", HTTP_STATUS.BAD_REQUEST);
    }

    // Convert File to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create multer-like file object
    const multerFile = {
      fieldname: "file",
      originalname: file.name,
      encoding: "7bit",
      mimetype: file.type,
      buffer: buffer,
      size: buffer.length,
    } as Express.Multer.File;

    // Upload profile picture
    const uploadResult = await uploadService.uploadProfilePicture(multerFile);

    // Update user profile picture
    await userService.updateUser(user.userId, {
      profilePicture: uploadResult.url,
    });

    return successResponse(
      {
        url: uploadResult.url,
        filename: uploadResult.filename,
      },
      "Profile picture uploaded successfully"
    );
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
    }
    return errorResponse(
      "Failed to upload profile picture",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * DELETE /api/users/profile/picture
 * Delete profile picture
 */
async function deleteHandler(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);

    if (!user) {
      return errorResponse("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    }

    // Get current user to check if has profile picture
    const currentUser = await authService.getCurrentUser(user.userId);

    if (currentUser.profilePicture) {
      // Extract filename from URL
      const filename = currentUser.profilePicture.split("/").pop();
      if (filename) {
        const filePath = `images/profiles/${filename}`;
        await uploadService.deleteFile(filePath);
      }
    }

    // Remove profile picture from database
    await userService.updateUser(user.userId, {
      profilePicture: null,
    });

    return noContentResponse();
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
    }
    return errorResponse(
      "Failed to delete profile picture",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

// Apply middlewares and export
async function authenticatedPutHandler(request: NextRequest) {
  const authResult = await authMiddleware(request);
  if (authResult) return authResult;
  return putHandler(request);
}

async function authenticatedDeleteHandler(request: NextRequest) {
  const authResult = await authMiddleware(request);
  if (authResult) return authResult;
  return deleteHandler(request);
}

export const PUT = errorHandler(
  loggingMiddleware(corsMiddleware(authenticatedPutHandler))
);
export const DELETE = errorHandler(
  loggingMiddleware(corsMiddleware(authenticatedDeleteHandler))
);
