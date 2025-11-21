export const APP_CONSTANTS = {
  APP_NAME: process.env.APP_NAME || 'LMS Platform',
  APP_URL: process.env.APP_URL || 'http://localhost:3000',
  API_VERSION: 'v1',
} as const;

// User Roles
export const USER_ROLES = {
  ADMIN: 'ADMIN',
  MENTOR: 'MENTOR',
  STUDENT: 'STUDENT',
} as const;

// User Status
export const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  INACTIVE: 'INACTIVE',
} as const;

// Mentor Status
export const MENTOR_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

// Course Status
export const COURSE_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;

// Course Level
export const COURSE_LEVEL = {
  BEGINNER: 'BEGINNER',
  INTERMEDIATE: 'INTERMEDIATE',
  ADVANCED: 'ADVANCED',
  ALL_LEVELS: 'ALL_LEVELS',
} as const;

// Material Types
export const MATERIAL_TYPE = {
  VIDEO: 'VIDEO',
  DOCUMENT: 'DOCUMENT',
  QUIZ: 'QUIZ',
  ASSIGNMENT: 'ASSIGNMENT',
} as const;

// Video Status
export const VIDEO_STATUS = {
  UPLOADING: 'UPLOADING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

// Video Quality
export const VIDEO_QUALITY = {
  Q360P: '360p',
  Q480P: '480p',
  Q720P: '720p',
  Q1080P: '1080p',
} as const;

// Transaction Status
export const TRANSACTION_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  CANCELLED: 'CANCELLED',
} as const;

// Payment Methods
export const PAYMENT_METHOD = {
  CREDIT_CARD: 'CREDIT_CARD',
  BANK_TRANSFER: 'BANK_TRANSFER',
  E_WALLET: 'E_WALLET',
  VIRTUAL_ACCOUNT: 'VIRTUAL_ACCOUNT',
} as const;

// Enrollment Status
export const ENROLLMENT_STATUS = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;

// Certificate Status
export const CERTIFICATE_STATUS = {
  PENDING: 'PENDING',
  ISSUED: 'ISSUED',
  REVOKED: 'REVOKED',
} as const;

// Notification Types
export const NOTIFICATION_TYPE = {
  COURSE_ENROLLMENT: 'COURSE_ENROLLMENT',
  COURSE_UPDATE: 'COURSE_UPDATE',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  CERTIFICATE_ISSUED: 'CERTIFICATE_ISSUED',
  COMMENT_REPLY: 'COMMENT_REPLY',
  REVIEW_RECEIVED: 'REVIEW_RECEIVED',
  MENTOR_APPROVED: 'MENTOR_APPROVED',
  MENTOR_REJECTED: 'MENTOR_REJECTED',
  SYSTEM_ANNOUNCEMENT: 'SYSTEM_ANNOUNCEMENT',
} as const;

// Notification Status
export const NOTIFICATION_STATUS = {
  UNREAD: 'UNREAD',
  READ: 'READ',
  ARCHIVED: 'ARCHIVED',
} as const;

// JWT Configuration
export const JWT_CONFIG = {
  ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'access-secret-key',
  REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key',
  ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
  REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',
} as const;

// Upload Limits
export const UPLOAD_LIMITS = {
  MAX_VIDEO_SIZE: parseInt(process.env.UPLOAD_MAX_SIZE || '52428800'), // 50MB default
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_DOCUMENT_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/ogg'],
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  ALLOWED_DOCUMENT_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
} as const;

// Video Processing
export const VIDEO_CONFIG = {
  RESOLUTIONS: ['360p', '480p', '720p', '1080p'],
  CODEC: 'libx264',
  BITRATES: {
    '360p': '500k',
    '480p': '1000k',
    '720p': '2500k',
    '1080p': '5000k',
  },
  THUMBNAIL_COUNT: 3,
  THUMBNAIL_SIZE: '320x180',
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

// Rate Limiting
export const RATE_LIMIT = {
  WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
} as const;

// Cache TTL (Time To Live in seconds)
export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
} as const;

// Course Progress
export const PROGRESS = {
  COMPLETION_THRESHOLD: 90, // 90% to mark as completed
  VIDEO_WATCH_THRESHOLD: 0.9, // 90% watched to mark as completed
} as const;

// Email Templates
export const EMAIL_TEMPLATES = {
  WELCOME: 'welcome',
  VERIFY_EMAIL: 'verify-email',
  RESET_PASSWORD: 'reset-password',
  COURSE_ENROLLMENT: 'course-enrollment',
  CERTIFICATE_ISSUED: 'certificate-issued',
  PAYMENT_SUCCESS: 'payment-success',
  PAYMENT_FAILED: 'payment-failed',
  MENTOR_APPROVED: 'mentor-approved',
  MENTOR_REJECTED: 'mentor-rejected',
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  PAYMENT_REQUIRED: 402,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  // Authentication
  INVALID_CREDENTIALS: 'Invalid email or password',
  UNAUTHORIZED: 'Unauthorized access',
  TOKEN_EXPIRED: 'Token has expired',
  TOKEN_INVALID: 'Invalid token',
  EMAIL_NOT_VERIFIED: 'Please verify your email first',

  // User
  USER_NOT_FOUND: 'User not found',
  USER_ALREADY_EXISTS: 'User already exists',
  USER_SUSPENDED: 'User account is suspended',

  // Course
  COURSE_NOT_FOUND: 'Course not found',
  COURSE_NOT_PUBLISHED: 'Course is not published yet',
  ALREADY_ENROLLED: 'You are already enrolled in this course',

  // Payment
  PAYMENT_FAILED: 'Payment failed',
  INVALID_TRANSACTION: 'Invalid transaction',

  // Upload
  FILE_TOO_LARGE: 'File size exceeds limit',
  INVALID_FILE_TYPE: 'Invalid file type',
  UPLOAD_FAILED: 'File upload failed',

  // Video
  VIDEO_PROCESSING_FAILED: 'Video processing failed',
  VIDEO_NOT_FOUND: 'Video not found',

  // General
  INVALID_INPUT: 'Invalid input data',
  INTERNAL_ERROR: 'Internal server error',
  NOT_FOUND: 'Resource not found',
  FORBIDDEN: 'Access forbidden',
  RATE_LIMIT_EXCEEDED: 'Too many requests',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  // Authentication
  REGISTRATION_SUCCESS: 'Registration successful',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  EMAIL_VERIFIED: 'Email verified successfully',
  PASSWORD_RESET: 'Password reset successful',

  // User
  PROFILE_UPDATED: 'Profile updated successfully',
  PASSWORD_CHANGED: 'Password changed successfully',

  // Course
  COURSE_CREATED: 'Course created successfully',
  COURSE_UPDATED: 'Course updated successfully',
  COURSE_DELETED: 'Course deleted successfully',
  ENROLLMENT_SUCCESS: 'Enrolled successfully',

  // Payment
  PAYMENT_SUCCESS: 'Payment successful',

  // Upload
  UPLOAD_SUCCESS: 'File uploaded successfully',

  // General
  OPERATION_SUCCESS: 'Operation completed successfully',
} as const;

// Activity Log Actions
export const ACTIVITY_ACTIONS = {
  // User Actions
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_REGISTER: 'USER_REGISTER',
  PROFILE_UPDATE: 'PROFILE_UPDATE',

  // Course Actions
  COURSE_VIEW: 'COURSE_VIEW',
  COURSE_ENROLL: 'COURSE_ENROLL',
  COURSE_CREATE: 'COURSE_CREATE',
  COURSE_UPDATE: 'COURSE_UPDATE',

  // Material Actions
  MATERIAL_VIEW: 'MATERIAL_VIEW',
  VIDEO_WATCH: 'VIDEO_WATCH',
  MATERIAL_COMPLETE: 'MATERIAL_COMPLETE',

  // Payment Actions
  PAYMENT_INITIATE: 'PAYMENT_INITIATE',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',

  // Certificate Actions
  CERTIFICATE_REQUEST: 'CERTIFICATE_REQUEST',
  CERTIFICATE_DOWNLOAD: 'CERTIFICATE_DOWNLOAD',
} as const;

// Platform Commission Rate
export const PLATFORM_COMMISSION = 0.2; // 20%

// Course Completion Requirements
export const COMPLETION_REQUIREMENTS = {
  MIN_PROGRESS_PERCENTAGE: 100, // Must complete 100% of materials
  CERTIFICATE_ENABLED: true,
} as const;

// Search Configuration
export const SEARCH_CONFIG = {
  MIN_QUERY_LENGTH: 2,
  MAX_RESULTS: 50,
  HIGHLIGHT_LENGTH: 150,
} as const;

// Regex Patterns
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  PHONE: /^\+?[1-9]\d{1,14}$/,
  URL: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
} as const;

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'DD MMM YYYY',
  DISPLAY_WITH_TIME: 'DD MMM YYYY HH:mm',
  ISO: 'YYYY-MM-DD',
  ISO_WITH_TIME: 'YYYY-MM-DD HH:mm:ss',
  TIME_ONLY: 'HH:mm',
} as const;

// Export all constants
const allConstants = {
  APP_CONSTANTS,
  USER_ROLES,
  USER_STATUS,
  MENTOR_STATUS,
  COURSE_STATUS,
  COURSE_LEVEL,
  MATERIAL_TYPE,
  VIDEO_STATUS,
  VIDEO_QUALITY,
  TRANSACTION_STATUS,
  PAYMENT_METHOD,
  ENROLLMENT_STATUS,
  CERTIFICATE_STATUS,
  NOTIFICATION_TYPE,
  NOTIFICATION_STATUS,
  JWT_CONFIG,
  UPLOAD_LIMITS,
  VIDEO_CONFIG,
  PAGINATION,
  RATE_LIMIT,
  CACHE_TTL,
  PROGRESS,
  EMAIL_TEMPLATES,
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  ACTIVITY_ACTIONS,
  PLATFORM_COMMISSION,
  COMPLETION_REQUIREMENTS,
  SEARCH_CONFIG,
  REGEX_PATTERNS,
  DATE_FORMATS,
};

export default allConstants;
