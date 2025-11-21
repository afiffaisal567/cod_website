import { Worker } from "bullmq";
import { certificateQueue, redisConnection } from "@/lib/queue";
import prisma from "@/lib/prisma";
import { generateCertificateNumber } from "@/utils/crypto.util";
import emailService from "@/services/email.service";
import notificationService from "@/services/notification.service";
import { logInfo, logError } from "@/utils/logger.util";
import { appConfig } from "@/config/app.config";

/**
 * Certificate Job Data
 */
interface CertificateJobData {
  enrollmentId: string;
  userId: string;
  courseId: string;
}

/**
 * Certificate Worker - Processes certificate generation jobs
 */
export const certificateWorker = new Worker<CertificateJobData>(
  "certificate",
  async (job) => {
    const { enrollmentId, userId, courseId } = job.data;

    logInfo(`Generating certificate for enrollment ${enrollmentId}`);

    try {
      // Get enrollment details with correct field names
      const enrollment = await prisma.enrollment.findUnique({
        where: { id: enrollmentId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              full_name: true,
            },
          },
          course: {
            include: {
              mentor: {
                include: {
                  user: {
                    select: {
                      id: true,
                      full_name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!enrollment) {
        throw new Error("Enrollment not found");
      }

      // Check if already has certificate
      if (enrollment.certificate_id) {
        logInfo(`Certificate already exists for enrollment ${enrollmentId}`);
        return { success: true, certificateId: enrollment.certificate_id };
      }

      // Generate certificate number
      const certificateNumber = generateCertificateNumber();

      // Create certificate record with correct field names
      const certificate = await prisma.certificate.create({
        data: {
          user_id: userId,
          course_id: courseId,
          certificate_number: certificateNumber,
          status: "ISSUED",
          issued_at: new Date(),
          metadata: {
            courseName: enrollment.course.title,
            studentName: enrollment.user.full_name,
            mentorName: enrollment.course.mentor.user.full_name,
            completedAt: enrollment.completed_at,
          },
        },
      });

      // Update enrollment with certificate
      await prisma.enrollment.update({
        where: { id: enrollmentId },
        data: { certificate_id: certificate.id },
      });

      // Generate certificate URL
      const certificateUrl = `${appConfig.url}/certificates/${certificate.id}`;

      // Send email notification
      await emailService.sendCertificateEmail(
        enrollment.user.email,
        enrollment.user.full_name,
        enrollment.course.title,
        certificateUrl
      );

      // Send in-app notification
      await notificationService.notifyCertificateIssued(
        userId,
        enrollment.course.title,
        certificate.id
      );

      logInfo(`Certificate generated successfully`, {
        certificateId: certificate.id,
      });

      return {
        success: true,
        certificateId: certificate.id,
        certificateNumber: certificate.certificate_number,
      };
    } catch (error) {
      logError(
        `Failed to generate certificate for enrollment ${enrollmentId}`,
        error
      );
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
  }
);

// Worker event handlers
certificateWorker.on("completed", (job) => {
  logInfo(`Certificate job completed`, { jobId: job.id });
});

certificateWorker.on("failed", (job, err) => {
  logError(`Certificate job failed`, { jobId: job?.id, error: err });
});

/**
 * Queue certificate generation - FIXED: Use the Queue, not the Worker
 */
export async function queueCertificateGeneration(
  enrollmentId: string,
  userId: string,
  courseId: string
): Promise<void> {
  // Add job to the queue using the Queue instance, not the Worker
  await certificateQueue.add("generate-certificate", {
    enrollmentId,
    userId,
    courseId,
  });
}

// Export the worker for starting/stopping
export default certificateWorker;
