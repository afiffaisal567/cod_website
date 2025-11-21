import { NextRequest, NextResponse } from "next/server";
import { rateLimitResponse } from "@/utils/response.util";
import { RATE_LIMIT } from "@/lib/constants";
import { redis } from "@/lib/redis";

/**
 * Rate Limiting Middleware using Upstash Redis
 */
export function rateLimit(options?: {
  windowMs?: number;
  maxRequests?: number;
}): (
  handler: (request: NextRequest) => Promise<NextResponse>
) => (request: NextRequest) => Promise<NextResponse> {
  const windowSeconds = Math.floor(
    (options?.windowMs || RATE_LIMIT.WINDOW_MS) / 1000
  );
  const maxRequests = options?.maxRequests || RATE_LIMIT.MAX_REQUESTS;

  return (handler) => {
    return async (request: NextRequest) => {
      // Get client identifier (IP address or user ID)
      const clientId = getClientIdentifier(request);
      const key = `ratelimit:${clientId}`;

      try {
        // Get current count
        const current = await redis.get<number>(key);

        if (current === null) {
          // First request in window
          await redis.set(key, 1, { ex: windowSeconds });
          return handler(request);
        }

        if (current >= maxRequests) {
          // Rate limit exceeded
          return rateLimitResponse(
            "Too many requests. Please try again later."
          );
        }

        // Increment counter
        await redis.incr(key);
        return handler(request);
      } catch (error) {
        console.error("Rate limit error:", error);
        // If Redis fails, allow the request
        return handler(request);
      }
    };
  };
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get user ID from authenticated request
  const userId = request.headers.get("x-user-id");
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP address
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : "unknown";

  return `ip:${ip}`;
}

/**
 * Stricter rate limit for sensitive endpoints
 */
export function strictRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  })(handler);
}

/**
 * Loose rate limit for public endpoints
 */
export function looseRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
  })(handler);
}
