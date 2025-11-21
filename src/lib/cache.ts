import { redis } from "./redis-upstash";
import { logInfo, logError, logDebug } from "@/utils/logger.util";

/**
 * Cache Configuration
 */
export const cacheConfig = {
  ttl: {
    short: 60, // 1 minute
    medium: 300, // 5 minutes
    long: 1800, // 30 minutes
    day: 86400, // 24 hours
    week: 604800, // 7 days
  },
  keyPrefix: {
    user: "user:",
    course: "course:",
    enrollment: "enrollment:",
    category: "category:",
    mentor: "mentor:",
    search: "search:",
    analytics: "analytics:",
    session: "session:",
  },
};

/**
 * Cache Key Builder
 */
class CacheKeyBuilder {
  private parts: string[] = [];

  constructor(prefix: string) {
    this.parts.push(prefix);
  }

  add(part: string | number): this {
    this.parts.push(String(part));
    return this;
  }

  addObject(obj: Record<string, any>): this {
    const sorted = Object.keys(obj)
      .sort()
      .map((key) => `${key}:${obj[key]}`);
    this.parts.push(...sorted);
    return this;
  }

  build(): string {
    return this.parts.join(":");
  }
}

/**
 * Cache Service
 */
export class CacheService {
  /**
   * Get cached data
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);

      if (!data) {
        return null;
      }

      logDebug("Cache hit", { key });
      return JSON.parse(data as string) as T;
    } catch (error) {
      logError("Cache get error", error);
      return null;
    }
  }

  /**
   * Set cache data
   */
  async set(
    key: string,
    data: any,
    ttl: number = cacheConfig.ttl.medium
  ): Promise<boolean> {
    try {
      await redis.setex(key, ttl, JSON.stringify(data));
      logDebug("Cache set", { key, ttl });
      return true;
    } catch (error) {
      logError("Cache set error", error);
      return false;
    }
  }

  /**
   * Delete cached data
   */
  async delete(key: string): Promise<boolean> {
    try {
      await redis.del(key);
      logDebug("Cache delete", { key });
      return true;
    } catch (error) {
      logError("Cache delete error", error);
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern - FIXED VERSION
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await redis.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      // Delete keys one by one to avoid spread issues with Upstash Redis
      let deletedCount = 0;
      for (const key of keys) {
        await redis.del(key);
        deletedCount++;
      }

      logInfo("Cache pattern delete", { pattern, count: deletedCount });
      return deletedCount;
    } catch (error) {
      logError("Cache pattern delete error", error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      logError("Cache exists error", error);
      return false;
    }
  }

  /**
   * Get or set cached data with function
   */
  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = cacheConfig.ttl.medium
  ): Promise<T> {
    try {
      // Try to get from cache
      const cached = await this.get<T>(key);

      if (cached !== null) {
        return cached;
      }

      // Execute function if not in cache
      const data = await fn();

      // Store in cache
      await this.set(key, data, ttl);

      return data;
    } catch (error) {
      logError("Cache getOrSet error", error);
      // If error, execute function without caching
      return fn();
    }
  }

  /**
   * Increment counter
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      const result = await redis.incrby(key, amount);
      return result;
    } catch (error) {
      logError("Cache increment error", error);
      return 0;
    }
  }

  /**
   * Decrement counter
   */
  async decrement(key: string, amount: number = 1): Promise<number> {
    try {
      const result = await redis.decrby(key, amount);
      return result;
    } catch (error) {
      logError("Cache decrement error", error);
      return 0;
    }
  }

  /**
   * Add to set
   */
  async addToSet(key: string, ...values: string[]): Promise<number> {
    try {
      // Handle spread safely for Upstash Redis
      let addedCount = 0;
      for (const value of values) {
        const result = await redis.sadd(key, value);
        if (result === 1) addedCount++;
      }
      return addedCount;
    } catch (error) {
      logError("Cache addToSet error", error);
      return 0;
    }
  }

  /**
   * Remove from set
   */
  async removeFromSet(key: string, ...values: string[]): Promise<number> {
    try {
      // Handle spread safely for Upstash Redis
      let removedCount = 0;
      for (const value of values) {
        const result = await redis.srem(key, value);
        if (result === 1) removedCount++;
      }
      return removedCount;
    } catch (error) {
      logError("Cache removeFromSet error", error);
      return 0;
    }
  }

  /**
   * Get set members
   */
  async getSetMembers(key: string): Promise<string[]> {
    try {
      const members = await redis.smembers(key);
      return members;
    } catch (error) {
      logError("Cache getSetMembers error", error);
      return [];
    }
  }

  /**
   * Check if member in set
   */
  async isMemberOfSet(key: string, value: string): Promise<boolean> {
    try {
      const result = await redis.sismember(key, value);
      return result === 1;
    } catch (error) {
      logError("Cache isMemberOfSet error", error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    keys: number;
    memory: string;
    hits: number;
    misses: number;
  }> {
    try {
      const keys = await redis.dbsize();

      return {
        keys,
        memory: "0 MB", // Upstash Redis doesn't provide memory info
        hits: 0,
        misses: 0,
      };
    } catch (error) {
      logError("Cache getStats error", error);
      return {
        keys: 0,
        memory: "0 MB",
        hits: 0,
        misses: 0,
      };
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    try {
      await redis.flushdb();
      logInfo("Cache cleared");
      return true;
    } catch (error) {
      logError("Cache clear error", error);
      return false;
    }
  }

  /**
   * Build cache key
   */
  buildKey(prefix: string): CacheKeyBuilder {
    return new CacheKeyBuilder(prefix);
  }
}

// ... rest of your specialized cache classes remain the same
export class UserCache extends CacheService {
  async getUser(userId: string) {
    const key = this.buildKey(cacheConfig.keyPrefix.user).add(userId).build();
    return this.get(key);
  }

  async setUser(userId: string, data: any, ttl: number = cacheConfig.ttl.long) {
    const key = this.buildKey(cacheConfig.keyPrefix.user).add(userId).build();
    return this.set(key, data, ttl);
  }

  async invalidateUser(userId: string) {
    const key = this.buildKey(cacheConfig.keyPrefix.user).add(userId).build();
    return this.delete(key);
  }

  async getUserSession(userId: string) {
    const key = this.buildKey(cacheConfig.keyPrefix.session)
      .add(userId)
      .build();
    return this.get(key);
  }

  async setUserSession(
    userId: string,
    data: any,
    ttl: number = cacheConfig.ttl.day
  ) {
    const key = this.buildKey(cacheConfig.keyPrefix.session)
      .add(userId)
      .build();
    return this.set(key, data, ttl);
  }
}

// Export singleton instances
export const cacheService = new CacheService();
export const userCache = new UserCache();
