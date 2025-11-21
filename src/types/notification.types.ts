import type { BaseEntity } from './common.types';

/**
 * Notification Types
 */

/**
 * Notification Type
 */
export type NotificationType =
  | 'COURSE_ENROLLMENT'
  | 'COURSE_UPDATE'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'CERTIFICATE_ISSUED'
  | 'COMMENT_REPLY'
  | 'REVIEW_RECEIVED'
  | 'MENTOR_APPROVED'
  | 'MENTOR_REJECTED'
  | 'SYSTEM_ANNOUNCEMENT';

/**
 * Notification Status
 */
export type NotificationStatus = 'UNREAD' | 'READ' | 'ARCHIVED';

/**
 * Notification
 */
export interface Notification extends BaseEntity {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  status: NotificationStatus;
  data?: Record<string, unknown>;
  readAt?: Date;
}

/**
 * Notification Settings
 */
export interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  courseUpdates: boolean;
  paymentNotifications: boolean;
  certificateNotifications: boolean;
  commentNotifications: boolean;
  reviewNotifications: boolean;
}

/**
 * Update Notification Settings
 */
export type UpdateNotificationSettings = Partial<NotificationSettings>;
