import type { BaseEntity } from './common.types';

/**
 * Course Types
 */

/**
 * Course Status
 */
export type CourseStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'ARCHIVED';

/**
 * Course Level
 */
export type CourseLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'ALL_LEVELS';

/**
 * Material Type
 */
export type MaterialType = 'VIDEO' | 'DOCUMENT' | 'QUIZ' | 'ASSIGNMENT';

/**
 * Course
 */
export interface Course extends BaseEntity {
  mentorId: string;
  title: string;
  slug: string;
  description: string;
  shortDescription?: string;
  thumbnail?: string;
  coverImage?: string;
  categoryId: string;
  level: CourseLevel;
  language: string;
  price: number;
  discountPrice?: number;
  isFree: boolean;
  isPremium: boolean;
  isFeatured: boolean;
  status: CourseStatus;
  publishedAt?: Date;
  requirements: string[];
  whatYouWillLearn: string[];
  targetAudience: string[];
  totalDuration: number;
  totalLectures: number;
  totalStudents: number;
  averageRating: number;
  totalReviews: number;
  totalViews: number;
  tags: string[];
}

/**
 * Course Detail
 */
export interface CourseDetail extends Course {
  mentor: {
    id: string;
    name: string;
    profilePicture?: string;
    expertise: string[];
    averageRating: number;
  };
  category: {
    id: string;
    name: string;
    slug: string;
  };
  sections: Section[];
  reviews?: Review[];
}

/**
 * Create Course Data
 */
export interface CreateCourseData {
  title: string;
  description: string;
  shortDescription?: string;
  categoryId: string;
  level: CourseLevel;
  language: string;
  price: number;
  discountPrice?: number;
  isFree: boolean;
  isPremium: boolean;
  requirements?: string[];
  whatYouWillLearn: string[];
  targetAudience?: string[];
  tags?: string[];
}

/**
 * Update Course Data
 */
export type UpdateCourseData = Partial<CreateCourseData>;

/**
 * Section
 */
export interface Section extends BaseEntity {
  courseId: string;
  title: string;
  description?: string;
  order: number;
  duration: number;
  materials?: Material[];
}

/**
 * Material
 */
export interface Material extends BaseEntity {
  sectionId: string;
  title: string;
  description?: string;
  type: MaterialType;
  content?: string;
  videoId?: string;
  documentUrl?: string;
  duration: number;
  order: number;
  isFree: boolean;
  resources?: Resource[];
}

/**
 * Resource
 */
export interface Resource extends BaseEntity {
  materialId: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
}

/**
 * Category
 */
export interface Category extends BaseEntity {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  parentId?: string;
  order: number;
  isActive: boolean;
}

/**
 * Review
 */
export interface Review extends BaseEntity {
  userId: string;
  courseId: string;
  rating: number;
  comment?: string;
  isAnonymous: boolean;
  helpfulCount: number;
  user?: {
    name: string;
    profilePicture?: string;
  };
}

/**
 * Comment
 */
export interface Comment extends BaseEntity {
  userId: string;
  materialId: string;
  parentId?: string;
  content: string;
  isEdited: boolean;
  user?: {
    name: string;
    profilePicture?: string;
  };
  replies?: Comment[];
}

/**
 * Course Statistics
 */
export interface CourseStatistics {
  totalCourses: number;
  publishedCourses: number;
  draftCourses: number;
  totalEnrollments: number;
  averageRating: number;
  totalRevenue: number;
}
