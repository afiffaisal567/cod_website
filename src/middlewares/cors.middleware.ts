import { NextRequest, NextResponse } from 'next/server';

// CORS configuration
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.APP_URL || '',
];

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'];

/**
 * CORS Middleware
 */
export function corsMiddleware(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const origin = request.headers.get('origin') || '';

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return handlePreflight(origin);
    }

    // Execute handler
    const response = await handler(request);

    // Add CORS headers to response
    return addCorsHeaders(response, origin);
  };
}

/**
 * Handle preflight OPTIONS requests
 */
function handlePreflight(origin: string): NextResponse {
  const response = new NextResponse(null, { status: 204 });

  // Check if origin is allowed
  if (isOriginAllowed(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  response.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
  response.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
  response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours

  return response;
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: NextResponse, origin: string): NextResponse {
  // Check if origin is allowed
  if (isOriginAllowed(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
  response.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));

  return response;
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string): boolean {
  // Allow requests with no origin (mobile apps, curl, etc.)
  if (!origin) {
    return true;
  }

  // Check against whitelist
  return ALLOWED_ORIGINS.includes(origin) || process.env.NODE_ENV === 'development';
}

/**
 * Public CORS (allow all origins)
 */
export function publicCors(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    // Handle preflight
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 204 });
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
      response.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
      return response;
    }

    const response = await handler(request);
    response.headers.set('Access-Control-Allow-Origin', '*');

    return response;
  };
}
