import { databaseConfig } from "./database.config";
import appConfig from "./app.config";
import emailConfig from "./email.config";
import paymentConfig from "./payment.config";
import storageConfig from "./storage.config";
import videoConfig from "./video.config";

export type { AppConfig } from "./app.config";
export type { EmailConfig } from "./email.config";
export type { PaymentConfig } from "./payment.config";
export type { StorageConfig } from "./storage.config";
export type { VideoConfig } from "./video.config";

// Export database config type
export type DatabaseConfig = typeof databaseConfig;

export {
  appConfig,
  databaseConfig,
  emailConfig,
  paymentConfig,
  storageConfig,
  videoConfig,
};

/**
 * Get all configurations
 */
export const config = {
  app: appConfig,
  database: databaseConfig,
  email: emailConfig,
  payment: paymentConfig,
  storage: storageConfig,
  video: videoConfig,
} as const;

/**
 * Validate required environment variables
 */
export function validateConfig(): void {
  const required = ["DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        "Please check your .env file."
    );
  }
}

/**
 * Get config value by path
 */
export function getConfig<T = unknown>(path: string, defaultValue?: T): T {
  const keys = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = config;

  for (const key of keys) {
    value = value?.[key];
    if (value === undefined) {
      return defaultValue as T;
    }
  }

  return value as T;
}

/**
 * Check if feature is enabled
 */
export function isFeatureEnabled(
  feature: keyof typeof appConfig.features
): boolean {
  return appConfig.features[feature];
}

export default config;
