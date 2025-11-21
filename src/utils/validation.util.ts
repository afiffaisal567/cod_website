import { ZodSchema, ZodError } from 'zod';
import { formatZodError } from './error.util';

/**
 * Validate data with Zod schema
 */
export async function validateData<T>(
  schema: ZodSchema<T>,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; errors: Record<string, string[]> }> {
  try {
    const validated = await schema.parseAsync(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, errors: formatZodError(error) };
    }
    return { success: false, errors: { general: ['Validation failed'] } };
  }
}

/**
 * Validate data synchronously
 */
export function validateDataSync<T>(
  schema: ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string[]> } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, errors: formatZodError(error) };
    }
    return { success: false, errors: { general: ['Validation failed'] } };
  }
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

/**
 * Validate UUID
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate pagination params
 */
export function validatePagination(page: unknown, limit: unknown): { page: number; limit: number } {
  const parsedPage = parseInt(String(page)) || 1;
  const parsedLimit = parseInt(String(limit)) || 10;

  return {
    page: Math.max(1, parsedPage),
    limit: Math.min(100, Math.max(1, parsedLimit)),
  };
}

/**
 * Validate sort order
 */
export function validateSortOrder(order: unknown): 'asc' | 'desc' {
  return order === 'asc' ? 'asc' : 'desc';
}

/**
 * Parse boolean from string
 */
export function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return false;
}

/**
 * Parse integer safely
 */
export function parseInteger(value: unknown, defaultValue: number = 0): number {
  const parsed = parseInt(String(value));
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse float safely
 */
export function parseFloatSafe(value: unknown, defaultValue: number = 0): number {
  const parsed = Number.parseFloat(String(value));
  return isNaN(parsed) ? defaultValue : parsed;
}
