import { z } from 'zod';
import { REGEX_PATTERNS } from './constants';

// ========================================
// AUTH SCHEMAS
// ========================================

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      REGEX_PATTERNS.PASSWORD,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  disability_type: z.enum([
    'BUTA_WARNA',
    'DISLEKSIA', 
    'KOGNITIF',
    'LOW_VISION',
    'MENTOR',
    'MOTORIK',
    'TUNARUNGU'
  ]).optional(),
  role: z.enum(['STUDENT', 'MENTOR']).optional().default('STUDENT'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(REGEX_PATTERNS.PASSWORD, 'Password does not meet requirements'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(REGEX_PATTERNS.PASSWORD, 'Password does not meet requirements'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// ========================================
// USER SCHEMAS
// ========================================
export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  disability_type: z.enum([
    'BUTA_WARNA',
    'DISLEKSIA', 
    'KOGNITIF',
    'LOW_VISION',
    'MENTOR',
    'MOTORIK',
    'TUNARUNGU'
  ]).optional(),
  bio: z.string().max(500).optional(),
  phoneNumber: z.string().regex(REGEX_PATTERNS.PHONE).optional().or(z.literal('')),
  dateOfBirth: z.coerce.date().optional(),
  address: z.string().max(200).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  country: z.string().max(100).optional().or(z.literal('')),
});

export const updateProfilePictureSchema = z.object({
  file: z.any(), // Will be validated by multer middleware
});

// ========================================
// MENTOR SCHEMAS
// ========================================

export const applyMentorSchema = z.object({
  expertise: z.array(z.string()).min(1, 'At least one expertise required').max(10),
  experience: z.number().int().min(0).max(50),
  education: z.string().max(200).optional(),
  bio: z.string().min(50, 'Bio must be at least 50 characters').max(1000),
  headline: z.string().min(10).max(100),
  website: z.string().url().optional().nullable(),
  linkedin: z.string().url().optional().nullable(),
  twitter: z.string().optional().nullable(),
  portfolio: z.string().optional().nullable(),
});

export const updateMentorProfileSchema = z.object({
  expertise: z.array(z.string()).min(1).max(10).optional(),
  experience: z.number().int().min(0).max(50).optional(),
  education: z.string().max(200).optional(),
  bio: z.string().min(50).max(1000).optional(),
  headline: z.string().min(10).max(100).optional(),
  website: z.string().url().optional().nullable(),
  linkedin: z.string().url().optional().nullable(),
  twitter: z.string().optional().nullable(),
  portfolio: z.string().optional().nullable(),
});

// ========================================
// COURSE SCHEMAS
// ========================================

export const createCourseSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  description: z.string().min(50, 'Description must be at least 50 characters').max(5000),
  shortDescription: z.string().max(200).optional(),
  categoryId: z.string().uuid('Invalid category ID'),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS']),
  language: z.string().min(2).max(10).default('id'),
  price: z.number().min(0),
  discountPrice: z.number().min(0).optional().nullable(),
  isFree: z.boolean().default(false),
  isPremium: z.boolean().default(false),
  requirements: z.array(z.string()).optional().default([]),
  whatYouWillLearn: z.array(z.string()).min(1, 'At least one learning outcome required'),
  targetAudience: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
});

export const updateCourseSchema = createCourseSchema.partial();

export const publishCourseSchema = z.object({
  courseId: z.string().uuid(),
});

export const archiveCourseSchema = z.object({
  courseId: z.string().uuid(),
});

// ========================================
// SECTION SCHEMAS
// ========================================

export const createSectionSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(3).max(200),
  description: z.string().max(500).optional(),
  order: z.number().int().min(0).optional(),
});

export const updateSectionSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(500).optional(),
  order: z.number().int().min(0).optional(),
});

export const reorderSectionsSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string().uuid(),
      order: z.number().int().min(0),
    })
  ),
});

// ========================================
// MATERIAL SCHEMAS
// ========================================

export const createMaterialSchema = z.object({
  sectionId: z.string().uuid(),
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  type: z.enum(['VIDEO', 'DOCUMENT', 'QUIZ', 'ASSIGNMENT']),
  content: z.string().optional(),
  documentUrl: z.string().url().optional(),
  duration: z.number().int().min(0).optional(),
  order: z.number().int().min(0).optional(),
  isFree: z.boolean().default(false),
});

export const updateMaterialSchema = createMaterialSchema.partial().omit({ sectionId: true });

export const reorderMaterialsSchema = z.object({
  materials: z.array(
    z.object({
      id: z.string().uuid(),
      order: z.number().int().min(0),
    })
  ),
});

// ========================================
// VIDEO SCHEMAS
// ========================================

export const uploadVideoSchema = z.object({
  file: z.any(), // Validated by multer
});

export const updateVideoProgressSchema = z.object({
  watchedDuration: z.number().int().min(0),
  lastPosition: z.number().int().min(0),
});

// ========================================
// ENROLLMENT SCHEMAS
// ========================================

export const enrollCourseSchema = z.object({
  courseId: z.string().uuid(),
});

export const updateProgressSchema = z.object({
  materialId: z.string().uuid(),
  watchedDuration: z.number().int().min(0).optional(),
  lastPosition: z.number().int().min(0).optional(),
  isCompleted: z.boolean().optional(),
});

// ========================================
// REVIEW SCHEMAS
// ========================================

export const createReviewSchema = z.object({
  courseId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10).max(1000).optional(),
  isAnonymous: z.boolean().default(false),
});

export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().min(10).max(1000).optional(),
  isAnonymous: z.boolean().optional(),
});

// ========================================
// COMMENT SCHEMAS
// ========================================

export const createCommentSchema = z.object({
  materialId: z.string().uuid(),
  content: z.string().min(1).max(1000),
  parentId: z.string().uuid().optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(1000),
});

// ========================================
// TRANSACTION SCHEMAS
// ========================================

export const createTransactionSchema = z.object({
  courseId: z.string().uuid(),
  paymentMethod: z.enum(['CREDIT_CARD', 'BANK_TRANSFER', 'E_WALLET', 'VIRTUAL_ACCOUNT']),
});

export const verifyTransactionSchema = z.object({
  orderId: z.string(),
});

// ========================================
// CERTIFICATE SCHEMAS
// ========================================

export const generateCertificateSchema = z.object({
  enrollmentId: z.string().uuid(),
});

export const verifyCertificateSchema = z.object({
  certificateNumber: z.string(),
});

// ========================================
// NOTIFICATION SCHEMAS
// ========================================

export const updateNotificationSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  courseUpdates: z.boolean().optional(),
  paymentNotifications: z.boolean().optional(),
  certificateNotifications: z.boolean().optional(),
});

// ========================================
// SEARCH SCHEMAS
// ========================================

export const searchCoursesSchema = z.object({
  query: z.string().min(2).optional(),
  categoryId: z.string().uuid().optional(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS']).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  isFree: z.boolean().optional(),
  rating: z.number().min(0).max(5).optional(),
  sortBy: z.enum(['price', 'rating', 'students', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

// ========================================
// PAGINATION SCHEMA
// ========================================

export const paginationSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ========================================
// ADMIN SCHEMAS
// ========================================

export const approveMentorSchema = z.object({
  mentorId: z.string().uuid(),
});

export const rejectMentorSchema = z.object({
  mentorId: z.string().uuid(),
  reason: z.string().min(10).max(500),
});

export const suspendUserSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(10).max(500),
});

export const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().regex(REGEX_PATTERNS.SLUG, 'Invalid slug format'),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
  parentId: z.string().uuid().optional().nullable(),
  order: z.number().int().min(0).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

// Export all schemas
const validationSchemas = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
  updateProfileSchema,
  updateProfilePictureSchema,
  applyMentorSchema,
  updateMentorProfileSchema,
  createCourseSchema,
  updateCourseSchema,
  publishCourseSchema,
  archiveCourseSchema,
  createSectionSchema,
  updateSectionSchema,
  reorderSectionsSchema,
  createMaterialSchema,
  updateMaterialSchema,
  reorderMaterialsSchema,
  uploadVideoSchema,
  updateVideoProgressSchema,
  enrollCourseSchema,
  updateProgressSchema,
  createReviewSchema,
  updateReviewSchema,
  createCommentSchema,
  updateCommentSchema,
  createTransactionSchema,
  verifyTransactionSchema,
  generateCertificateSchema,
  verifyCertificateSchema,
  updateNotificationSettingsSchema,
  searchCoursesSchema,
  paginationSchema,
  approveMentorSchema,
  rejectMentorSchema,
  suspendUserSchema,
  createCategorySchema,
  updateCategorySchema,
};

export default validationSchemas;