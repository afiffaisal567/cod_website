import prisma from "@/lib/prisma";
import emailService from "./email.service";
import type {
  NotificationType,
  Notification,
  NotificationSettings,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";

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
    // Check notification settings
    let settings: NotificationSettings | null = null;

    try {
      // Use the correct Prisma model name (notification_settings becomes notificationSettings)
      settings = await prisma.notificationSettings.findUnique({
        where: { user_id: userId },
      });
    } catch (error) {
      console.error("Failed to fetch notification settings:", error);
      // Continue without settings (all notifications enabled by default)
    }

    // Check if this type of notification is enabled
    if (settings && !this.isNotificationEnabled(settings, type)) {
      return; // Skip notification
    }

    // Create notification - use camelCase for Prisma client
    await prisma.notification.create({
      data: {
        user_id: userId,
        type,
        title,
        message,
        data: (data || {}) as Prisma.JsonObject,
        status: "UNREAD",
      },
    });

    // Send email if enabled - use camelCase for Prisma client fields
    if (settings?.email_notifications) {
      await this.sendEmailNotification(userId, title, message);
    }
  }

  /**
   * Check if notification type is enabled
   */
  private isNotificationEnabled(
    settings: NotificationSettings,
    type: NotificationType
  ): boolean {
    const typeMap: Record<string, keyof NotificationSettings> = {
      COURSE_ENROLLMENT: "course_updates",
      COURSE_UPDATE: "course_updates",
      PAYMENT_SUCCESS: "payment_notifications",
      PAYMENT_FAILED: "payment_notifications",
      CERTIFICATE_ISSUED: "certificate_notifications",
      COMMENT_REPLY: "comment_notifications",
      REVIEW_RECEIVED: "review_notifications",
      MENTOR_APPROVED: "course_updates", // Map to appropriate setting
      MENTOR_REJECTED: "course_updates", // Map to appropriate setting
      SYSTEM_ANNOUNCEMENT: "email_notifications", // Use general email setting
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
        select: { email: true, full_name: true },
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
      console.error("Failed to send email notification:", error);
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string,
    limit: number = 10
  ): Promise<Notification[]> {
    return prisma.notification.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
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
      `You've successfully enrolled in ${courseName}`,
      { courseName }
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
      "CERTIFICATE_ISSUED",
      "Certificate Ready",
      `Your certificate for ${courseName} is ready to download`,
      { courseName, certificateId }
    );
  }

  async notifyMentorApproved(userId: string): Promise<void> {
    await this.create(
      userId,
      "MENTOR_APPROVED",
      "Mentor Application Approved",
      "Congratulations! Your mentor application has been approved"
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
