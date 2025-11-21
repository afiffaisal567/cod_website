import prisma from '@/lib/prisma';
import emailService from './email.service';
import type { NotificationType, Notification } from '@prisma/client';
import type { Prisma } from '@prisma/client';

// Define UserPreferences interface if not exported from Prisma
interface UserPreferences {
  id: string;
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  courseUpdates: boolean;
  paymentNotifications: boolean;
  certificateNotifications: boolean;
  commentNotifications: boolean;
  reviewNotifications: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationService {
  /**
   * Create notification
   */
  async create(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    // Check notification settings - try multiple possible table names
    let settings: UserPreferences | null = null;

    try {
      // Try userPreferences first
      const userPrefsTable = prisma as {
        userPreferences?: {
          findUnique: (args: { where: { userId: string } }) => Promise<UserPreferences | null>;
        };
      };
      if (userPrefsTable.userPreferences) {
        settings = await userPrefsTable.userPreferences.findUnique({
          where: { userId },
        });
      }
    } catch {
      // If that fails, try notificationPreferences
      try {
        const notifPrefsTable = prisma as {
          notificationPreferences?: {
            findUnique: (args: { where: { userId: string } }) => Promise<UserPreferences | null>;
          };
        };
        if (notifPrefsTable.notificationPreferences) {
          settings = await notifPrefsTable.notificationPreferences.findUnique({
            where: { userId },
          });
        }
      } catch {
        // If both fail, continue without settings (all notifications enabled)
        settings = null;
      }
    }

    // Check if this type of notification is enabled
    if (settings && !this.isNotificationEnabled(settings, type)) {
      return; // Skip notification
    }

    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: (data || {}) as Prisma.JsonObject,
        status: 'UNREAD',
      },
    });

    // Send email if enabled
    if (settings?.emailNotifications) {
      await this.sendEmailNotification(userId, title, message);
    }
  }

  /**
   * Check if notification type is enabled
   */
  private isNotificationEnabled(settings: UserPreferences, type: NotificationType): boolean {
    const typeMap: Record<string, keyof UserPreferences> = {
      COURSE_ENROLLMENT: 'courseUpdates',
      COURSE_UPDATE: 'courseUpdates',
      PAYMENT_SUCCESS: 'paymentNotifications',
      PAYMENT_FAILED: 'paymentNotifications',
      CERTIFICATE_ISSUED: 'certificateNotifications',
      COMMENT_REPLY: 'commentNotifications',
      REVIEW_RECEIVED: 'reviewNotifications',
    };

    const settingKey = typeMap[type];
    return settingKey ? Boolean(settings[settingKey]) : true;
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    userId: string,
    title: string,
    message: string
  ): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (user) {
        // Queue email (don't wait)
        emailService.queue({
          to: user.email,
          subject: title,
          html: `
            <h2>${title}</h2>
            <p>${message}</p>
            <p>Best regards,<br>LMS Platform Team</p>
          `,
        });
      }
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string, limit: number = 10): Promise<Notification[]> {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: 'READ',
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: {
        userId,
        status: 'UNREAD',
      },
      data: {
        status: 'READ',
        readAt: new Date(),
      },
    });
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    await prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        status: 'UNREAD',
      },
    });
  }

  /**
   * Clean old notifications (older than 90 days)
   */
  async cleanOldNotifications(days: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        status: 'READ',
      },
    });

    return result.count;
  }

  // Convenience methods for common notifications
  async notifyCourseEnrollment(userId: string, courseName: string): Promise<void> {
    await this.create(
      userId,
      'COURSE_ENROLLMENT',
      'Course Enrollment',
      `You've successfully enrolled in ${courseName}`,
      { courseName }
    );
  }

  async notifyPaymentSuccess(userId: string, courseName: string, amount: number): Promise<void> {
    await this.create(
      userId,
      'PAYMENT_SUCCESS',
      'Payment Successful',
      `Your payment of Rp${amount.toLocaleString()} for ${courseName} was successful`,
      { courseName, amount }
    );
  }

  async notifyCertificateIssued(
    userId: string,
    courseName: string,
    certificateId: string
  ): Promise<void> {
    await this.create(
      userId,
      'CERTIFICATE_ISSUED',
      'Certificate Ready',
      `Your certificate for ${courseName} is ready to download`,
      { courseName, certificateId }
    );
  }

  async notifyMentorApproved(userId: string): Promise<void> {
    await this.create(
      userId,
      'MENTOR_APPROVED',
      'Mentor Application Approved',
      'Congratulations! Your mentor application has been approved'
    );
  }

  async notifyMentorRejected(userId: string, reason: string): Promise<void> {
    await this.create(
      userId,
      'MENTOR_REJECTED',
      'Mentor Application Update',
      `Your mentor application was not approved. Reason: ${reason}`,
      { reason }
    );
  }
}

const notificationService = new NotificationService();
export default notificationService;
