import { Worker, Job } from 'bullmq';
import { sendEmail } from '@/lib/email';
import { logInfo, logError } from '@/utils/logger.util';

/**
 * Email Job Data
 */
interface EmailJobData {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
  }>;
}

/**
 * Email Worker
 * Processes email sending jobs
 */
export const emailWorker = new Worker<EmailJobData>(
  'email',
  async (job: Job<EmailJobData>) => {
    const { to, subject, html, text, attachments } = job.data;

    logInfo(`Sending email to ${to}`, { subject });

    try {
      await sendEmail({
        to,
        subject,
        html,
        text,
        attachments,
      });

      logInfo(`Email sent successfully to ${to}`);

      return { success: true, to, subject };
    } catch (error) {
      logError(`Failed to send email to ${to}`, error);
      throw error;
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    concurrency: 5, // Process 5 emails concurrently
  }
);

// Worker event handlers
emailWorker.on('completed', (job) => {
  logInfo(`Email job completed`, { jobId: job.id });
});

emailWorker.on('failed', (job, err) => {
  logError(`Email job failed`, { jobId: job?.id, error: err });
});

export default emailWorker;
