import { logInfo, logError, logWarn } from "@/utils/logger.util";

/**
 * Database Configuration
 */
export const databaseConfig = {
  // Connection pool settings
  pool: {
    min: parseInt(process.env.DATABASE_POOL_MIN || "2"),
    max: parseInt(process.env.DATABASE_POOL_MAX || "10"),
    idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || "30000"),
    connectionTimeoutMillis: parseInt(
      process.env.DATABASE_CONNECTION_TIMEOUT || "10000"
    ),
  },

  // Query optimization
  query: {
    timeoutMs: parseInt(process.env.DATABASE_QUERY_TIMEOUT || "15000"),
    slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || "3000"),
  },

  // Logging
  logging: {
    enabled: process.env.DATABASE_LOGGING === "true",
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

// Extended type for query operations
interface QueryOperationParams {
  operation: string;
  model: string;
  args: any;
  query: (args: any) => Promise<any>;
}

/**
 * Database Connection Manager
 */
class DatabaseManager {
  private prisma: any = null;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;

  /**
   * Get Prisma Client instance
   */
  getClient(): any {
    if (!this.prisma) {
      try {
        // Dynamic import to avoid build-time issues
        const { PrismaClient } = require("@prisma/client");
        this.prisma = new PrismaClient({
          log: this.getLogConfig(),
          datasources: {
            db: {
              url: process.env.DATABASE_URL,
            },
          },
        });

        this.setupEventHandlers();
      } catch (error) {
        logError("Failed to initialize Prisma Client", error);
        throw new Error(
          "Prisma Client is not available. Please run 'npx prisma generate'"
        );
      }
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

    const logConfig: any[] = ["query", "error", "warn"];

    return logConfig;
  }

  /**
   * Setup event handlers for logging
   */
  private setupEventHandlers() {
    if (!this.prisma) return;

    // Query logging with performance monitoring
    this.prisma.$extends({
      query: {
        async $allOperations({
          operation,
          model,
          args,
          query,
        }: QueryOperationParams) {
          const start = Date.now();
          const result = await query(args);
          const duration = Date.now() - start;

          // Log slow queries
          if (duration > databaseConfig.query.slowQueryThreshold) {
            logWarn("Slow query detected", {
              model,
              operation,
              duration: `${duration}ms`,
            });
          }

          return result;
        },
      },
    });
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      "P1001", // Can't reach database server
      "P1002", // Database server timeout
      "P1008", // Operations timed out
      "P2024", // Timed out fetching a connection
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

      logInfo("Database connected successfully");
    } catch (error) {
      this.connectionAttempts++;
      logError("Database connection failed", {
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
      logInfo("Database disconnected");
    } catch (error) {
      logError("Database disconnection failed", error);
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
      logError("Database health check failed", error);
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
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: { model?: string; action?: string } = {}
  ): Promise<T> {
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < databaseConfig.retry.maxAttempts) {
      try {
        return await operation();
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

          logWarn(`Database operation failed, retrying in ${backoff}ms`, {
            attempt: attempts,
            ...context,
          });

          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    }

    throw lastError;
  }

  /**
   * Optimize database tables (analyze)
   */
  async optimize(): Promise<void> {
    try {
      const client = this.getClient();

      // Analyze tables for query optimization
      await client.$executeRaw`ANALYZE`;

      logInfo("Database optimization completed");
    } catch (error) {
      logError("Database optimization failed", error);
    }
  }
}

// Export singleton instance
export const databaseManager = new DatabaseManager();

// Export default Prisma client
export const prisma = databaseManager.getClient();

// Export database config as default
export default databaseConfig;
