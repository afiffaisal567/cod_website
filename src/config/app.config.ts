export const appConfig = {
  // Application Info
  name: process.env.APP_NAME || 'course_online_disabilitas',
  url: process.env.APP_URL || 'http://localhost:3000',
  version: '1.0.0',

  // Environment
  env: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // Server
  port: parseInt(process.env.PORT || '3000', 10),

  // API Configuration
  api: {
    version: 'v1',
    prefix: '/api',
    timeout: 30000, // 30 seconds
    maxBodySize: '50mb',
  },

  // JWT Configuration
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  // Security
  security: {
    bcryptRounds: 12,
    tokenLength: 32,
    passwordMinLength: 8,
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  },

  // Pagination
  pagination: {
    defaultPage: 1,
    defaultLimit: 10,
    maxLimit: 100,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Cache TTL (in seconds)
  cache: {
    short: 60, // 1 minute
    medium: 300, // 5 minutes
    long: 3600, // 1 hour
    veryLong: 86400, // 24 hours
  },

  // Course Settings
  course: {
    commissionRate: 0.2, // 20% platform commission
    minPrice: 0,
    maxPrice: 10000000, // 10 million IDR
    completionThreshold: 90, // 90% to mark as completed
  },

  // Admin Default Credentials (must be set via environment variables)
  admin: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  },

  // Feature Flags
  features: {
    emailVerification: true,
    socialLogin: false,
    certificate: true,
    analytics: true,
    recommendations: true,
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs',
  },
} as const;

export type AppConfig = typeof appConfig;

export default appConfig;
