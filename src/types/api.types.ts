import type { NextRequest } from 'next/server';
import type { PaginationParams, FilterOptions } from './common.types';

/**
 * API Types
 * Request and response interfaces for API routes
 */

/**
 * Authenticated Request
 */
export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

/**
 * API Context
 */
export interface ApiContext {
  params: Record<string, string>;
}

/**
 * List Query Params
 * Combines pagination and filtering
 */
export interface ListQueryParams {
  // Pagination
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  // Filtering
  search?: string;
  status?: string;
  category?: string;
  dateFrom?: Date;
  dateTo?: Date;
  [key: string]: string | number | Date | undefined;
}

/**
 * API Error
 */
export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

/**
 * Validation Error
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Batch Operation Result
 */
export interface BatchOperationResult {
  success: number;
  failed: number;
  total: number;
  errors?: Array<{ id: string; error: string }>;
}

/**
 * Upload Response
 */
export interface UploadResponse {
  filename: string;
  url: string;
  size: number;
  mimetype: string;
}

/**
 * Delete Response
 */
export interface DeleteResponse {
  id: string;
  deleted: boolean;
}

/**
 * Update Response
 */
export interface UpdateResponse<T> {
  id: string;
  data: T;
  updated: boolean;
}
