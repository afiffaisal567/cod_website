// middlewares/auth.middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken, extractTokenFromHeader } from "@/lib/auth";
import { unauthorizedResponse, forbiddenResponse } from "@/utils/response.util";
import { USER_STATUS } from "@/lib/constants";
import prisma from "@/lib/prisma";

// Interface untuk user yang terautentikasi
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
}

export async function authMiddleware(
  request: NextRequest
): Promise<{ user: AuthenticatedUser } | NextResponse> {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      console.log("❌ No token provided");
      return unauthorizedResponse("No token provided");
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
      console.log("✅ Token verified:", { userId: payload.userId });
    } catch (error) {
      console.log("❌ Token verification failed:", error);
      return unauthorizedResponse("Invalid token");
    }

    // Check if user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      console.log("❌ User not found:", payload.userId);
      return unauthorizedResponse("User not found");
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      console.log("❌ User not active:", user.status);
      return forbiddenResponse("User account is suspended or inactive");
    }

    console.log("✅ User authenticated:", {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Return user object instead of modifying headers
    return {
      user: {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
    };
  } catch (error) {
    console.error("❌ Auth middleware error:", error);
    return unauthorizedResponse("Authentication failed");
  }
}

export function requireAuth(
  handler: (
    request: NextRequest,
    user: AuthenticatedUser
  ) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const authResult = await authMiddleware(request);

    // Jika authResult adalah NextResponse (error), kembalikan error
    if (authResult instanceof NextResponse) {
      console.log("❌ Auth failed, returning:", authResult.status);
      return authResult;
    }

    // Jika authResult berisi user, panggil handler dengan user
    console.log("✅ Auth successful, proceeding to handler");
    return handler(request, authResult.user);
  };
}
