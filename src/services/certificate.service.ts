import prisma from "@/lib/prisma";
import { generateCertificateNumber } from "@/utils/crypto.util";
import emailService from "./email.service";
import notificationService from "./notification.service";
import { logInfo, logError } from "@/utils/logger.util";
import { appConfig } from "@/config/app.config";

/**
 * Certificate Service
 * Menangani pembuatan sertifikat secara synchronous
 */
export class CertificateService {
  /**
   * Generate certificate secara synchronous
   */
  async generateCertificate(
    enrollmentId: string,
    userId: string,
    courseId: string
  ): Promise<{ certificateId: string; certificateNumber: string }> {
    logInfo(`Generating certificate for enrollment ${enrollmentId}`);

    try {
      // Get enrollment details
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
        return {
          certificateId: enrollment.certificate_id,
          certificateNumber: "", // Akan diisi nanti
        };
      }

      // Generate certificate number
      const certificateNumber = generateCertificateNumber();

      // Create certificate record
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
            duration: enrollment.course.total_duration,
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
        certificateNumber: certificate.certificate_number,
      });

      return {
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
  }

  /**
   * Verify certificate
   */
  async verifyCertificate(certificateNumber: string) {
    const certificate = await prisma.certificate.findUnique({
      where: { certificate_number: certificateNumber },
      include: {
        user: {
          select: {
            full_name: true,
            email: true,
          },
        },
        course: {
          select: {
            title: true,
            mentor: {
              include: {
                user: {
                  select: {
                    full_name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!certificate) {
      return {
        isValid: false,
        message: "Certificate not found",
      };
    }

    if (certificate.status !== "ISSUED") {
      return {
        isValid: false,
        message: `Certificate is ${certificate.status.toLowerCase()}`,
      };
    }

    return {
      isValid: true,
      certificate: {
        number: certificate.certificate_number,
        studentName: certificate.user.full_name,
        courseName: certificate.course.title,
        mentorName: certificate.course.mentor.user.full_name,
        issuedAt: certificate.issued_at,
        status: certificate.status,
      },
    };
  }

  /**
   * Get user certificates
   */
  async getUserCertificates(
    userId: string,
    page: number = 1,
    limit: number = 10
  ) {
    const skip = (page - 1) * limit;

    const [certificates, total] = await Promise.all([
      prisma.certificate.findMany({
        where: { user_id: userId },
        include: {
          course: {
            select: {
              title: true,
              thumbnail: true,
              mentor: {
                include: {
                  user: {
                    select: {
                      full_name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { issued_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.certificate.count({
        where: { user_id: userId },
      }),
    ]);

    return {
      data: certificates,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Revoke certificate
   */
  async revokeCertificate(certificateId: string, reason: string) {
    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
    });

    if (!certificate) {
      throw new Error("Certificate not found");
    }

    if (certificate.status === "REVOKED") {
      throw new Error("Certificate already revoked");
    }

    await prisma.certificate.update({
      where: { id: certificateId },
      data: {
        status: "REVOKED",
        revoked_at: new Date(),
        revoke_reason: reason,
      },
    });

    logInfo(`Certificate revoked`, { certificateId, reason });

    return { success: true };
  }
}

// Export singleton instance
const certificateService = new CertificateService();
export default certificateService;
