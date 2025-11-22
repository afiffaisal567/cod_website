import { NextRequest, NextResponse } from "next/server";
import { rateLimitResponse } from "@/utils/response.util";
import { RATE_LIMIT } from "@/lib/constants";

// In-memory store untuk rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate Limiting Middleware menggunakan In-Memory Store
 */
export function rateLimit(options?: {
  windowMs?: number;
  maxRequests?: number;
}): (
  handler: (request: NextRequest) => Promise<NextResponse>
) => (request: NextRequest) => Promise<NextResponse> {
  const windowMs = options?.windowMs || RATE_LIMIT.WINDOW_MS;
  const maxRequests = options?.maxRequests || RATE_LIMIT.MAX_REQUESTS;

  return (handler) => {
    return async (request: NextRequest) => {
      // Get client identifier (IP address atau user ID)
      const clientId = getClientIdentifier(request);
      const now = Date.now();
      const key = `ratelimit:${clientId}`;

      // Clean up expired entries periodically
      if (Math.random() < 0.01) {
        // 1% chance to clean up
        cleanupExpiredEntries();
      }

      const clientData = rateLimitStore.get(key);

      if (!clientData) {
        // First request
        rateLimitStore.set(key, {
          count: 1,
          resetTime: now + windowMs,
        });
        return handler(request);
      }

      // Check if window has expired
      if (now > clientData.resetTime) {
        rateLimitStore.set(key, {
          count: 1,
          resetTime: now + windowMs,
        });
        return handler(request);
      }

      // Check if rate limit exceeded
      if (clientData.count >= maxRequests) {
        return rateLimitResponse("Too many requests. Please try again later.");
      }

      // Increment counter
      clientData.count++;
      rateLimitStore.set(key, clientData);

      return handler(request);
    };
  };
}

/**
 * Get client identifier untuk rate limiting
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
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Stricter rate limit untuk sensitive endpoints
 */
export function strictRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
  })(handler);
}

/**
 * Loose rate limit untuk public endpoints
 */
export function looseRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
  })(handler);
}
