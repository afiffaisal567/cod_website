import { NextRequest, NextResponse } from 'next/server';
import { rateLimitResponse } from '@/utils/response.util';
import { RATE_LIMIT } from '@/lib/constants';

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate Limiting Middleware
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
      // Get client identifier (IP address or user ID)
      const clientId = getClientIdentifier(request);

      // Check rate limit
      const isAllowed = checkRateLimit(clientId, windowMs, maxRequests);

      if (!isAllowed) {
        return rateLimitResponse('Too many requests. Please try again later.');
      }

      // Proceed to handler
      return handler(request);
    };
  };
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get user ID from authenticated request
  const userId = request.headers.get('x-user-id');
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown';

  return `ip:${ip}`;
}

/**
 * Check if request is within rate limit
 */
function checkRateLimit(clientId: string, windowMs: number, maxRequests: number): boolean {
  const now = Date.now();
  const clientData = rateLimitStore.get(clientId);

  // First request or expired window
  if (!clientData || now > clientData.resetTime) {
    rateLimitStore.set(clientId, {
      count: 1,
      resetTime: now + windowMs,
    });
    return true;
  }

  // Within window
  if (clientData.count < maxRequests) {
    clientData.count++;
    return true;
  }

  // Rate limit exceeded
  return false;
}

/**
 * Cleanup expired rate limit entries (call periodically)
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();

  for (const [clientId, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(clientId);
    }
  }
}

// Cleanup every 5 minutes
if (typeof window === 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
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
