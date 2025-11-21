import prisma from "@/lib/prisma";
import notificationService from "./notification.service";
import { NotFoundError, ConflictError, AppError } from "@/utils/error.util";
import { HTTP_STATUS, ENROLLMENT_STATUS, COURSE_STATUS } from "@/lib/constants";
import type { EnrollmentStatus, Prisma } from "@prisma/client";

/**
 * Enrollment Service
 * Handles course enrollment and progress tracking
 */
export class EnrollmentService {
  /**
   * Enroll user in course
   */
  async enrollCourse(
    user_id: string,
    course_id: string,
    transaction_id?: string
  ) {
    // Get course details
    const course = await prisma.course.findUnique({
      where: { id: course_id },
    });

    if (!course) {
      throw new NotFoundError("Course not found");
    }

    // Check if course is published
    if (course.status !== COURSE_STATUS.PUBLISHED) {
      throw new AppError(
        "Course is not available for enrollment",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        user_id_course_id: {
          user_id,
          course_id,
        },
      },
    });

    if (existingEnrollment) {
      throw new ConflictError("You are already enrolled in this course");
    }

    // For paid courses, verify transaction
    if (!course.is_free) {
      if (!transaction_id) {
        throw new AppError(
          "Transaction ID required for paid courses",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      // Verify transaction is paid
      const transaction = await prisma.transaction.findUnique({
        where: { id: transaction_id },
      });

      if (!transaction || transaction.status !== "PAID") {
        throw new AppError(
          "Valid payment required to enroll",
          HTTP_STATUS.PAYMENT_REQUIRED || 402
        );
      }

      if (
        transaction.user_id !== user_id ||
        transaction.course_id !== course_id
      ) {
        throw new AppError(
          "Transaction does not match enrollment",
          HTTP_STATUS.BAD_REQUEST
        );
      }
    }

    // Create enrollment
    const enrollment = await prisma.$transaction(async (tx) => {
      // Create enrollment record
      const newEnrollment = await tx.enrollment.create({
        data: {
          user_id,
          course_id,
          status: ENROLLMENT_STATUS.ACTIVE,
          progress: 0,
        },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              thumbnail: true,
            },
          },
        },
      });

      // Update course total students
      await tx.course.update({
        where: { id: course_id },
        data: {
          total_students: { increment: 1 },
        },
      });

      return newEnrollment;
    });

    // Send notifications
    await notificationService.notifyCourseEnrollment(user_id, course.title);

    return enrollment;
  }

  /**
   * Get user enrollments
   */
  async getUserEnrollments(
    user_id: string,
    options: {
      page?: number;
      limit?: number;
      status?: EnrollmentStatus;
    } = {}
  ) {
    const { page = 1, limit = 10, status } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.EnrollmentWhereInput = { user_id };
    if (status) {
      where.status = status;
    }

    const [enrollments, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              thumbnail: true,
              level: true,
              total_duration: true,
              total_lectures: true,
              mentor: {
                select: {
                  user: {
                    select: {
                      full_name: true,
                      avatar_url: true,
                    },
                  },
                },
              },
            },
          },
          certificate: {
            select: {
              id: true,
              certificate_number: true,
              issued_at: true,
            },
          },
        },
      }),
      prisma.enrollment.count({ where }),
    ]);

    return {
      data: enrollments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get enrollment by ID
   */
  async getEnrollmentById(enrollment_id: string, user_id?: string) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollment_id },
      include: {
        course: {
          include: {
            sections: {
              orderBy: { order: "asc" },
              include: {
                materials: {
                  orderBy: { order: "asc" },
                },
              },
            },
            mentor: {
              include: {
                user: {
                  select: {
                    full_name: true,
                    avatar_url: true,
                  },
                },
              },
            },
          },
        },
        progress_records: {
          include: {
            material: {
              select: {
                id: true,
                title: true,
                type: true,
                duration: true,
              },
            },
          },
        },
        certificate: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundError("Enrollment not found");
    }

    // Check permission
    if (user_id && enrollment.user_id !== user_id) {
      throw new AppError("Access denied", HTTP_STATUS.FORBIDDEN);
    }

    return enrollment;
  }

  /**
   * Get detailed progress
   */
  async getEnrollmentProgress(enrollment_id: string, user_id?: string) {
    const enrollment = await this.getEnrollmentById(enrollment_id, user_id);

    // Calculate progress per section
    const sectionProgress = await Promise.all(
      enrollment.course.sections.map(async (section) => {
        const materials = section.materials;
        const totalMaterials = materials.length;

        const completedMaterials = await prisma.progress.count({
          where: {
            enrollment_id,
            material_id: { in: materials.map((m: any) => m.id) },
            is_completed: true,
          },
        });

        return {
          section_id: section.id,
          section_title: section.title,
          total_materials: totalMaterials,
          completed_materials: completedMaterials,
          progress:
            totalMaterials > 0
              ? (completedMaterials / totalMaterials) * 100
              : 0,
        };
      })
    );

    return {
      enrollment_id: enrollment.id,
      course_id: enrollment.course_id,
      overall_progress: enrollment.progress,
      sections: sectionProgress,
      last_accessed_at: enrollment.last_accessed_at,
    };
  }

  /**
   * Check enrollment status
   */
  async checkEnrollmentStatus(user_id: string, course_id: string) {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        user_id_course_id: {
          user_id,
          course_id,
        },
      },
      select: {
        id: true,
        status: true,
        progress: true,
        completed_at: true,
      },
    });

    return {
      is_enrolled: !!enrollment,
      enrollment: enrollment || null,
    };
  }

  /**
   * Update enrollment progress
   */
  async updateEnrollmentProgress(enrollment_id: string) {
    // Get all materials in course
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollment_id },
      include: {
        course: {
          include: {
            sections: {
              include: {
                materials: true,
              },
            },
          },
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundError("Enrollment not found");
    }

    // Count total and completed materials
    const allMaterialIds = enrollment.course.sections.flatMap((section: any) =>
      section.materials.map((m: any) => m.id)
    );

    const totalMaterials = allMaterialIds.length;

    const completedMaterials = await prisma.progress.count({
      where: {
        enrollment_id,
        material_id: { in: allMaterialIds },
        is_completed: true,
      },
    });

    const progress =
      totalMaterials > 0 ? (completedMaterials / totalMaterials) * 100 : 0;

    // Update enrollment
    const updated = await prisma.enrollment.update({
      where: { id: enrollment_id },
      data: {
        progress,
        status:
          progress >= 100
            ? ENROLLMENT_STATUS.COMPLETED
            : ENROLLMENT_STATUS.ACTIVE,
        completed_at: progress >= 100 ? new Date() : null,
      },
    });

    // Issue certificate if completed
    if (progress >= 100 && !enrollment.certificate_id) {
      // Queue certificate generation
      const { queueCertificateGeneration } = await import(
        "@/workers/certificate.worker"
      );
      await queueCertificateGeneration(
        enrollment_id,
        enrollment.user_id,
        enrollment.course_id
      );
    }

    return updated;
  }

  /**
   * Cancel enrollment
   */
  async cancelEnrollment(enrollment_id: string, user_id?: string) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollment_id },
    });

    if (!enrollment) {
      throw new NotFoundError("Enrollment not found");
    }

    // Check permission
    if (user_id && enrollment.user_id !== user_id) {
      throw new AppError("Access denied", HTTP_STATUS.FORBIDDEN);
    }

    // Update status
    await prisma.enrollment.update({
      where: { id: enrollment_id },
      data: { status: ENROLLMENT_STATUS.CANCELLED },
    });

    return { id: enrollment_id, cancelled: true };
  }

  /**
   * Update last accessed time
   */
  async updateLastAccessed(enrollment_id: string) {
    await prisma.enrollment.update({
      where: { id: enrollment_id },
      data: {
        last_accessed_at: new Date(),
      },
    });
  }

  /**
   * Get popular courses based on enrollments
   */
  async getPopularCourses(limit: number = 10) {
    const popularCourses = await prisma.enrollment.groupBy({
      by: ["course_id"],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
      take: limit,
    });

    // Get course details
    const courseIds = popularCourses.map((item) => item.course_id);
    const courses = await prisma.course.findMany({
      where: {
        id: { in: courseIds },
      },
      include: {
        mentor: {
          include: {
            user: {
              select: {
                full_name: true,
                avatar_url: true,
              },
            },
          },
        },
        enrollments: {
          select: {
            id: true,
          },
        },
      },
    });

    // Merge enrollment counts with course data
    const coursesWithCounts = courses.map((course) => {
      const enrollmentData = popularCourses.find(
        (item) => item.course_id === course.id
      );
      return {
        ...course,
        enrollment_count: enrollmentData?._count.id || 0,
      };
    });

    return coursesWithCounts.sort(
      (a, b) => b.enrollment_count - a.enrollment_count
    );
  }

  /**
   * Get enrollment statistics for user
   */
  async getUserEnrollmentStats(user_id: string) {
    const [totalEnrollments, activeEnrollments, completedEnrollments] =
      await Promise.all([
        prisma.enrollment.count({
          where: { user_id },
        }),
        prisma.enrollment.count({
          where: {
            user_id,
            status: ENROLLMENT_STATUS.ACTIVE,
          },
        }),
        prisma.enrollment.count({
          where: {
            user_id,
            status: ENROLLMENT_STATUS.COMPLETED,
          },
        }),
      ]);

    const averageProgress = await prisma.enrollment.aggregate({
      where: {
        user_id,
        status: ENROLLMENT_STATUS.ACTIVE,
      },
      _avg: {
        progress: true,
      },
    });

    return {
      total_enrollments: totalEnrollments,
      active_enrollments: activeEnrollments,
      completed_enrollments: completedEnrollments,
      average_progress: averageProgress._avg.progress || 0,
    };
  }

  /**
   * Get recently accessed courses
   */
  async getRecentlyAccessed(user_id: string, limit: number = 5) {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        user_id,
        last_accessed_at: { not: null },
      },
      orderBy: {
        last_accessed_at: "desc",
      },
      take: limit,
      include: {
        course: {
          select: {
            id: true,
            title: true,
            thumbnail: true,
            slug: true,
            total_duration: true,
          },
        },
      },
    });

    return enrollments;
  }
}

const enrollmentService = new EnrollmentService();
export default enrollmentService;
