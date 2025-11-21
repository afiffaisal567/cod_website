// src/lib/auth.ts
import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from './constants';

// JWT Payload Interface
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Token Pair Interface
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Generate Access Token
 */
export function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const secret = process.env.JWT_ACCESS_SECRET || JWT_CONFIG.ACCESS_SECRET;
  const expiresIn = process.env.JWT_ACCESS_EXPIRY || JWT_CONFIG.ACCESS_EXPIRY;

  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET is not defined');
  }

  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

/**
 * Generate Refresh Token
 */
export function generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const secret = process.env.JWT_REFRESH_SECRET || JWT_CONFIG.REFRESH_SECRET;
  const expiresIn = process.env.JWT_REFRESH_EXPIRY || JWT_CONFIG.REFRESH_EXPIRY;

  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET is not defined');
  }

  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

/**
 * Generate both Access and Refresh tokens
 */
export function generateTokenPair(payload: Omit<JWTPayload, 'iat' | 'exp'>): TokenPair {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}

/**
 * Verify Access Token
 */
export function verifyAccessToken(token: string): JWTPayload {
  try {
    const secret = process.env.JWT_ACCESS_SECRET || JWT_CONFIG.ACCESS_SECRET;

    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is not defined');
    }

    return jwt.verify(token, secret) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Access token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid access token');
    }
    throw new Error('Token verification failed');
  }
}

/**
 * Verify Refresh Token
 */
export function verifyRefreshToken(token: string): JWTPayload {
  try {
    const secret = process.env.JWT_REFRESH_SECRET || JWT_CONFIG.REFRESH_SECRET;

    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not defined');
    }

    return jwt.verify(token, secret) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    throw new Error('Token verification failed');
  }
}

/**
 * Verify Token (alias for verifyAccessToken for backward compatibility)
 */
export function verifyToken(token: string): JWTPayload {
  return verifyAccessToken(token);
}

/**
 * Decode token without verification (useful for debugging)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return true;

    return Date.now() >= decoded.exp * 1000;
  } catch {
    return true;
  }
}

/**
 * Get token expiry time
 */
export function getTokenExpiry(token: string): Date | null {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return null;

    return new Date(decoded.exp * 1000);
  } catch {
    return null;
  }
}
