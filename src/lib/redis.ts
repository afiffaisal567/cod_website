import 'dotenv/config';
import { Redis } from '@upstash/redis';

/**
 * Upstash Redis Client (REST-based)
 */
export const redis = new Redis({
  url: process.env.REDIS_URL || '',
  token: process.env.REDIS_TOKEN || '',
});

/**
 * Cache Interface
 */
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
}

/**
 * Set cache value
 */
export async function setCache(key: string, value: unknown, options?: CacheOptions): Promise<void> {
  const serialized = JSON.stringify(value);

  if (options?.ttl) {
    await redis.setex(key, options.ttl, serialized);
  } else {
    await redis.set(key, serialized);
  }
}

/**
 * Get cache value
 */
export async function getCache<T = unknown>(key: string): Promise<T | null> {
  const value = await redis.get(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value as string) as T;
  } catch {
    return value as T;
  }
}

/**
 * Delete cache value
 */
export async function deleteCache(key: string): Promise<void> {
  await redis.del(key);
}

/**
 * Delete cache by pattern
 */
export async function deleteCacheByPattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);

  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

/**
 * Check if key exists
 */
export async function cacheExists(key: string): Promise<boolean> {
  const exists = await redis.exists(key);
  return exists === 1;
}

/**
 * Increment cache value
 */
export async function incrementCache(key: string, amount: number = 1): Promise<number> {
  return redis.incrby(key, amount);
}

/**
 * Set cache with expiry
 */
export async function setCacheWithExpiry(
  key: string,
  value: unknown,
  seconds: number
): Promise<void> {
  await setCache(key, value, { ttl: seconds });
}

/**
 * Get or set cache
 */
export async function getOrSetCache<T>(
  key: string,
  factory: () => Promise<T>,
  options?: CacheOptions
): Promise<T> {
  // Try to get from cache
  const cached = await getCache<T>(key);

  if (cached !== null) {
    return cached;
  }

  // Generate value
  const value = await factory();

  // Store in cache
  await setCache(key, value, options);

  return value;
}

console.log('✅ Upstash Redis connected');

export default redis;
