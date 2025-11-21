/**
 * Pagination Parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Filter Options
 */
export interface FilterOptions {
  search?: string;
  status?: string;
  category?: string;
  dateFrom?: Date;
  dateTo?: Date;
  [key: string]: string | Date | undefined;
}

/**
 * Sort Options
 */
export interface SortOptions {
  field: string;
  order: 'asc' | 'desc';
}

/**
 * Date Range
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * API Response
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
  meta?: PaginationMeta;
  timestamp: string;
}

/**
 * ID Parameter
 */
export interface IdParam {
  id: string;
}

/**
 * File Upload
 */
export interface FileUpload {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  url: string;
}

/**
 * Success/Error Result
 */
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

/**
 * Nullable
 */
export type Nullable<T> = T | null;

/**
 * Optional
 */
export type Optional<T> = T | undefined;

/**
 * Timestamp
 */
export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Soft Delete
 */
export interface SoftDelete {
  deletedAt?: Date | null;
}

/**
 * Base Entity
 */
export interface BaseEntity extends Timestamps {
  id: string;
}

/**
 * Select Options
 */
export interface SelectOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
}

/**
 * Statistics
 */
export interface Statistics {
  total: number;
  active?: number;
  inactive?: number;
  growth?: number;
  percentage?: number;
}
