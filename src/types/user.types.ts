import type { BaseEntity } from './common.types';

/**
 * User Types
 */

/**
 * User Role
 */
export type UserRole = 'ADMIN' | 'MENTOR' | 'STUDENT';

/**
 * User Status
 */
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

/**
 * User
 */
export interface User extends BaseEntity {
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  profilePicture?: string;
  bio?: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
  address?: string;
  city?: string;
  country?: string;
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  lastLoginAt?: Date;
}

/**
 * User Profile
 */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  profilePicture?: string;
  bio?: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
  address?: string;
  city?: string;
  country?: string;
  emailVerified: boolean;
  createdAt: Date;
}

/**
 * Update Profile Data
 */
export interface UpdateProfileData {
  name?: string;
  bio?: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
  address?: string;
  city?: string;
  country?: string;
}

/**
 * Mentor Profile
 */
export interface MentorProfile extends BaseEntity {
  userId: string;
  expertise: string[];
  experience: number;
  education?: string;
  bio?: string;
  headline?: string;
  website?: string;
  linkedin?: string;
  twitter?: string;
  portfolio?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  totalStudents: number;
  totalCourses: number;
  averageRating: number;
  totalReviews: number;
  totalRevenue: number;
}

/**
 * Mentor Application
 */
export interface MentorApplication {
  expertise: string[];
  experience: number;
  education?: string;
  bio: string;
  headline: string;
  website?: string;
  linkedin?: string;
  twitter?: string;
  portfolio?: string;
}

/**
 * Wishlist Item
 */
export interface WishlistItem {
  id: string;
  userId: string;
  courseId: string;
  course: {
    id: string;
    title: string;
    thumbnail?: string;
    price: number;
  };
  createdAt: Date;
}

/**
 * User Activity
 */
export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

/**
 * User Statistics
 */
export interface UserStatistics {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  newUsersThisMonth: number;
  mentors: number;
  students: number;
}
