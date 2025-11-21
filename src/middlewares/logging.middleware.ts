import { NextRequest, NextResponse } from 'next/server';
import { logHttp, logError } from '@/utils/logger.util';

/**
 * Logging Middleware
 * Logs all API requests and responses
 */
export function loggingMiddleware(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const startTime = Date.now();
    const { method, url } = request;

    try {
      // Execute handler
      const response = await handler(request);

      // Calculate duration
      const duration = Date.now() - startTime;

      // Log request
      logHttp(`${method} ${url} ${response.status} - ${duration}ms`);

      // Add timing header
      response.headers.set('X-Response-Time', `${duration}ms`);

      return response;
    } catch (error) {
      // Log error
      const duration = Date.now() - startTime;
      logError(`${method} ${url} - ${duration}ms`, error);

      throw error;
    }
  };
}

/**
 * Detailed logging with request/response bodies
 */
export function detailedLogging(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const startTime = Date.now();
    const { method, url } = request;

    // Log request details
    console.log('📥 Request:', {
      method,
      url,
      headers: Object.fromEntries(request.headers.entries()),
      timestamp: new Date().toISOString(),
    });

    // Clone request to read body without consuming it
    const requestClone = request.clone();
    try {
      const body = await requestClone.json();
      console.log('📦 Request Body:', body);
    } catch {
      // Body is not JSON or already consumed
    }

    try {
      // Execute handler
      const response = await handler(request);
      const duration = Date.now() - startTime;

      // Log response
      console.log('📤 Response:', {
        status: response.status,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('❌ Error:', {
        method,
        url,
        duration: `${duration}ms`,
        error,
      });

      throw error;
    }
  };
}

/**
 * Performance monitoring
 */
export function performanceMonitoring(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const startTime = Date.now();

    const response = await handler(request);

    const duration = Date.now() - startTime;

    // Warn if request takes too long
    if (duration > 1000) {
      console.warn(`⚠️ Slow request: ${request.method} ${request.url} - ${duration}ms`);
    }

    return response;
  };
}
