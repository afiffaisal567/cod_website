import { Worker, Job } from 'bullmq';
import notificationService from '@/services/notification.service';
import { logInfo, logError } from '@/utils/logger.util';
import type { NotificationType } from '@prisma/client';

/**
 * Notification Job Data
 */
interface NotificationJobData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Notification Worker
 * Processes notification creation jobs
 */
export const notificationWorker = new Worker<NotificationJobData>(
  'notification',
  async (job: Job<NotificationJobData>) => {
    const { userId, type, title, message, data } = job.data;

    logInfo(`Creating notification for user ${userId}`, { type, title });

    try {
      await notificationService.create(userId, type, title, message, data);

      logInfo(`Notification created successfully for user ${userId}`);

      return { success: true, userId, type };
    } catch (error) {
      logError(`Failed to create notification for user ${userId}`, error);
      throw error;
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    concurrency: 10, // Process 10 notifications concurrently
  }
);

// Worker event handlers
notificationWorker.on('completed', (job) => {
  logInfo(`Notification job completed`, { jobId: job.id });
});

notificationWorker.on('failed', (job, err) => {
  logError(`Notification job failed`, { jobId: job?.id, error: err });
});

export default notificationWorker;
