import type { BaseEntity } from './common.types';

/**
 * Enrollment Types
 */

/**
 * Enrollment Status
 */
export type EnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

/**
 * Enrollment
 */
export interface Enrollment extends BaseEntity {
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  progress: number;
  completedAt?: Date;
  expiresAt?: Date;
  lastAccessedAt?: Date;
  certificateId?: string;
}

/**
 * Enrollment Detail
 */
export interface EnrollmentDetail extends Enrollment {
  course: {
    id: string;
    title: string;
    thumbnail?: string;
    totalDuration: number;
    totalLectures: number;
    mentor: {
      name: string;
      profilePicture?: string;
    };
  };
  progressRecords?: Progress[];
  certificate?: {
    id: string;
    certificateNumber: string;
    issuedAt: Date;
  };
}

/**
 * Progress
 */
export interface Progress extends BaseEntity {
  enrollmentId: string;
  materialId: string;
  userId: string;
  isCompleted: boolean;
  watchedDuration: number;
  lastPosition: number;
  completedAt?: Date;
}

/**
 * Update Progress Data
 */
export interface UpdateProgressData {
  materialId: string;
  watchedDuration?: number;
  lastPosition?: number;
  isCompleted?: boolean;
}

/**
 * Course Progress Summary
 */
export interface CourseProgressSummary {
  courseId: string;
  totalMaterials: number;
  completedMaterials: number;
  progress: number;
  totalDuration: number;
  watchedDuration: number;
  lastAccessedAt?: Date;
}

/**
 * Learning Statistics
 */
export interface LearningStatistics {
  totalEnrollments: number;
  activeEnrollments: number;
  completedCourses: number;
  totalWatchTime: number;
  averageProgress: number;
  certificatesEarned: number;
}
