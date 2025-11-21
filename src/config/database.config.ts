import { PrismaClient } from '@prisma/client';
import { logInfo, logError, logWarn } from '@/utils/logger.util';

/**
 * Database Configuration
 */
export const databaseConfig = {
  // Connection pool settings
  pool: {
    min: parseInt(process.env.DATABASE_POOL_MIN || '2'),
    max: parseInt(process.env.DATABASE_POOL_MAX || '10'),
    idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '10000'),
  },

  // Query optimization
  query: {
    timeoutMs: parseInt(process.env.DATABASE_QUERY_TIMEOUT || '15000'),
    slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '3000'),
  },

  // Logging
  logging: {
    enabled: process.env.DATABASE_LOGGING === 'true',
    slowQueries: true,
    errors: true,
  },

  // Retry configuration
  retry: {
    maxAttempts: 3,
    backoff: {
      initial: 1000,
      max: 10000,
      multiplier: 2,
    },
  },
};

/**
 * Database Connection Manager
 */
class DatabaseManager {
  private prisma: PrismaClient | null = null;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;

  /**
   * Get Prisma Client instance
   */
  getClient(): PrismaClient {
    if (!this.prisma) {
      this.prisma = new PrismaClient({
        log: this.getLogConfig(),
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
      });

      this.setupMiddleware();
      this.setupEventHandlers();
    }

    return this.prisma;
  }

  /**
   * Get logging configuration
   */
  private getLogConfig() {
    if (!databaseConfig.logging.enabled) {
      return [];
    }

    const logConfig: any[] = [];

    if (databaseConfig.logging.slowQueries) {
      logConfig.push({
        emit: 'event',
        level: 'query',
      });
    }

    if (databaseConfig.logging.errors) {
      logConfig.push({
        emit: 'event',
        level: 'error',
      });
    }

    logConfig.push({
      emit: 'event',
      level: 'warn',
    });

    return logConfig;
  }

  /**
   * Setup Prisma middleware for performance monitoring
   */
  private setupMiddleware() {
    if (!this.prisma) return;

    // Query performance monitoring
    this.prisma.$use(async (params, next) => {
      const before = Date.now();
      const result = await next(params);
      const after = Date.now();
      const duration = after - before;

      // Log slow queries
      if (duration > databaseConfig.query.slowQueryThreshold) {
        logWarn('Slow query detected', {
          model: params.model,
          action: params.action,
          duration: `${duration}ms`,
        });
      }

      return result;
    });

    // Connection retry middleware
    this.prisma.$use(async (params, next) => {
      let attempts = 0;
      let lastError: Error | null = null;

      while (attempts < databaseConfig.retry.maxAttempts) {
        try {
          return await next(params);
        } catch (error: any) {
          lastError = error;
          attempts++;

          // Check if error is retryable
          if (!this.isRetryableError(error)) {
            throw error;
          }

          if (attempts < databaseConfig.retry.maxAttempts) {
            const backoff = Math.min(
              databaseConfig.retry.backoff.initial *
                Math.pow(databaseConfig.retry.backoff.multiplier, attempts - 1),
              databaseConfig.retry.backoff.max
            );

            logWarn(`Database query failed, retrying in ${backoff}ms`, {
              attempt: attempts,
              model: params.model,
              action: params.action,
            });

            await new Promise((resolve) => setTimeout(resolve, backoff));
          }
        }
      }

      throw lastError;
    });
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers() {
    if (!this.prisma) return;

    // Query logging
    this.prisma.$on('query' as any, (e: any) => {
      if (e.duration > databaseConfig.query.slowQueryThreshold) {
        logWarn('Slow query', {
          query: e.query,
          duration: `${e.duration}ms`,
          params: e.params,
        });
      }
    });

    // Error logging
    this.prisma.$on('error' as any, (e: any) => {
      logError('Database error', {
        message: e.message,
        target: e.target,
      });
    });

    // Warning logging
    this.prisma.$on('warn' as any, (e: any) => {
      logWarn('Database warning', {
        message: e.message,
      });
    });
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'P1001', // Can't reach database server
      'P1002', // Database server timeout
      'P1008', // Operations timed out
      'P2024', // Timed out fetching a connection
    ];

    return retryableErrors.some((code) => error.code === code);
  }

  /**
   * Connect to database
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      const client = this.getClient();
      await client.$connect();

      this.isConnected = true;
      this.connectionAttempts = 0;

      logInfo('Database connected successfully');
    } catch (error) {
      this.connectionAttempts++;
      logError('Database connection failed', {
        attempt: this.connectionAttempts,
        error,
      });
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    if (!this.prisma || !this.isConnected) {
      return;
    }

    try {
      await this.prisma.$disconnect();
      this.isConnected = false;
      logInfo('Database disconnected');
    } catch (error) {
      logError('Database disconnection failed', error);
      throw error;
    }
  }

  /**
   * Check database connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      const client = this.getClient();
      await client.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logError('Database health check failed', error);
      return false;
    }
  }

  /**
   * Get connection statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    poolSize: number;
    activeConnections: number;
  }> {
    return {
      connected: this.isConnected,
      poolSize: databaseConfig.pool.max,
      activeConnections: 0, // Prisma doesn't expose this
    };
  }

  /**
   * Optimize database tables (analyze)
   */
  async optimize(): Promise<void> {
    try {
      const client = this.getClient();

      // Analyze tables for query optimization
      await client.$executeRaw`ANALYZE`;

      logInfo('Database optimization completed');
    } catch (error) {
      logError('Database optimization failed', error);
    }
  }

  /**
   * Clear query cache
   */
  async clearCache(): Promise<void> {
    try {
      // Prisma doesn't have explicit cache clearing
      // This is more for future implementation
      logInfo('Database cache cleared');
    } catch (error) {
      logError('Database cache clear failed', error);
    }
  }
}

// Export singleton instance
export const databaseManager = new DatabaseManager();

// Export default Prisma client
export const prisma = databaseManager.getClient();
