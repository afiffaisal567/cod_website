import prisma from "@/lib/prisma";
import emailService from "./email.service";
import { logInfo, logError } from "@/utils/logger.util";

// Define types locally since Prisma types are not available
type NotificationType =
  | "COURSE_ENROLLMENT"
  | "COURSE_UPDATE"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED"
  | "CERTIFICATE_ISSUED"
  | "COMMENT_REPLY"
  | "REVIEW_RECEIVED"
  | "MENTOR_APPROVED"
  | "MENTOR_REJECTED"
  | "SYSTEM_ANNOUNCEMENT";

type NotificationStatus = "UNREAD" | "READ";

interface NotificationData {
  [key: string]: unknown;
}

export class NotificationService {
  /**
   * Create notification secara synchronous
   */
  async create(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: NotificationData
  ): Promise<void> {
    try {
      // Check notification settings
      let settings = await prisma.notificationSettings.findUnique({
        where: { user_id: userId },
      });

      // Create default settings jika tidak ada
      if (!settings) {
        settings = await prisma.notificationSettings.create({
          data: {
            user_id: userId,
            email_notifications: true,
            push_notifications: true,
            course_updates: true,
            payment_notifications: true,
            certificate_notifications: true,
            comment_notifications: true,
            review_notifications: true,
          },
        });
      }

      // Check if this type of notification is enabled
      if (!this.isNotificationEnabled(settings, type)) {
        return; // Skip notification
      }

      // Create notification di database
      const notification = await prisma.notification.create({
        data: {
          user_id: userId,
          type,
          title,
          message,
          data: data || {},
          status: "UNREAD" as NotificationStatus,
        },
      });

      logInfo(`Notification created`, {
        notificationId: notification.id,
        userId,
        type,
      });

      // Send email jika enabled
      if (settings.email_notifications && this.shouldSendEmail(type)) {
        await this.sendEmailNotification(userId, title, message);
      }
    } catch (error) {
      logError("Failed to create notification", error);
      throw error;
    }
  }

  /**
   * Check if notification type is enabled
   */
  private isNotificationEnabled(
    settings: any,
    type: NotificationType
  ): boolean {
    const typeMap: Record<string, keyof typeof settings> = {
      COURSE_ENROLLMENT: "course_updates",
      COURSE_UPDATE: "course_updates",
      PAYMENT_SUCCESS: "payment_notifications",
      PAYMENT_FAILED: "payment_notifications",
      CERTIFICATE_ISSUED: "certificate_notifications",
      COMMENT_REPLY: "comment_notifications",
      REVIEW_RECEIVED: "review_notifications",
      MENTOR_APPROVED: "course_updates",
      MENTOR_REJECTED: "course_updates",
      SYSTEM_ANNOUNCEMENT: "email_notifications",
    };

    const settingKey = typeMap[type];
    return settingKey ? Boolean(settings[settingKey]) : true;
  }

  /**
   * Check if should send email for this notification type
   */
  private shouldSendEmail(type: NotificationType): boolean {
    const emailTypes = [
      "COURSE_ENROLLMENT",
      "PAYMENT_SUCCESS",
      "PAYMENT_FAILED",
      "CERTIFICATE_ISSUED",
      "MENTOR_APPROVED",
      "MENTOR_REJECTED",
      "SYSTEM_ANNOUNCEMENT",
    ];

    return emailTypes.includes(type);
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
        select: { email: true, full_name: true },
      });

      if (user) {
        await emailService.sendNow({
          to: user.email,
          subject: title,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4F46E5;">${title}</h2>
              <p style="font-size: 16px; line-height: 1.5;">${message}</p>
              <p style="color: #666; font-size: 14px;">
                Best regards,<br>
                LMS Platform Team
              </p>
            </div>
          `,
        });

        logInfo(`Email notification sent`, { userId, email: user.email });
      }
    } catch (error) {
      logError("Failed to send email notification", error);
      // Don't throw error, just log it
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string,
    limit: number = 10,
    page: number = 1
  ) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { user_id: userId },
        orderBy: { created_at: "desc" },
        take: limit,
        skip,
      }),
      prisma.notification.count({
        where: { user_id: userId },
      }),
    ]);

    return {
      data: notifications,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: "READ",
        read_at: new Date(),
      },
    });
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: {
        user_id: userId,
        status: "UNREAD",
      },
      data: {
        status: "READ",
        read_at: new Date(),
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
        user_id: userId,
        status: "UNREAD",
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
        created_at: {
          lt: cutoffDate,
        },
        status: "READ",
      },
    });

    logInfo(`Cleaned old notifications`, { count: result.count, days });
    return result.count;
  }

  // Convenience methods for common notifications
  async notifyCourseEnrollment(
    userId: string,
    courseName: string
  ): Promise<void> {
    await this.create(
      userId,
      "COURSE_ENROLLMENT",
      "Course Enrollment",
      `You've successfully enrolled in "${courseName}". Start learning now!`,
      { courseName, type: "enrollment" }
    );
  }

  async notifyPaymentSuccess(
    userId: string,
    courseName: string,
    amount: number
  ): Promise<void> {
    await this.create(
      userId,
      "PAYMENT_SUCCESS",
      "Payment Successful",
      `Your payment of Rp${amount.toLocaleString()} for "${courseName}" was successful.`,
      { courseName, amount, type: "payment_success" }
    );
  }

  async notifyCertificateIssued(
    userId: string,
    courseName: string,
    certificateId: string
  ): Promise<void> {
    await this.create(
      userId,
      "CERTIFICATE_ISSUED",
      "Certificate Ready",
      `Your certificate for "${courseName}" is ready to download.`,
      { courseName, certificateId, type: "certificate" }
    );
  }

  async notifyMentorApproved(userId: string): Promise<void> {
    await this.create(
      userId,
      "MENTOR_APPROVED",
      "Mentor Application Approved",
      "Congratulations! Your mentor application has been approved. You can now create and publish courses."
    );
  }

  async notifyMentorRejected(userId: string, reason: string): Promise<void> {
    await this.create(
      userId,
      "MENTOR_REJECTED",
      "Mentor Application Update",
      `Your mentor application was not approved. Reason: ${reason}`,
      { reason }
    );
  }
}

const notificationService = new NotificationService();
export default notificationService;
