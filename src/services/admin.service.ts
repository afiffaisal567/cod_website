import prisma from "@/lib/prisma";
import { hashPassword } from "@/utils/crypto.util";
import { AppError, NotFoundError } from "@/utils/error.util";
import { HTTP_STATUS } from "@/lib/constants";
import type { Prisma, UserRole, UserStatus } from "@prisma/client";

/**
 * Admin Service
 * Handles administrative operations
 */
export class AdminService {
  /**
   * Get platform statistics
   */
  async getPlatformStatistics() {
    const [
      totalUsers,
      totalMentors,
      totalCourses,
      totalEnrollments,
      totalRevenue,
      pendingMentorApplications,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.mentorProfile.count({
        where: { status: "APPROVED" },
      }),
      prisma.course.count({
        where: { status: "PUBLISHED" },
      }),
      prisma.enrollment.count(),
      prisma.transaction.aggregate({
        where: { status: "PAID" },
        _sum: { total_amount: true },
      }),
      prisma.mentorProfile.count({
        where: { status: "PENDING" },
      }),
    ]);

    // Recent growth (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [newUsers, newCourses, newEnrollments, recentRevenue] =
      await Promise.all([
        prisma.user.count({
          where: {
            created_at: { gte: thirtyDaysAgo },
          },
        }),
        prisma.course.count({
          where: {
            created_at: { gte: thirtyDaysAgo },
            status: "PUBLISHED",
          },
        }),
        prisma.enrollment.count({
          where: {
            created_at: { gte: thirtyDaysAgo },
          },
        }),
        prisma.transaction.aggregate({
          where: {
            status: "PAID",
            paid_at: { gte: thirtyDaysAgo },
          },
          _sum: { total_amount: true },
        }),
      ]);

    return {
      overview: {
        total_users: totalUsers,
        total_mentors: totalMentors,
        total_courses: totalCourses,
        total_enrollments: totalEnrollments,
        total_revenue: totalRevenue._sum?.total_amount || 0,
        pending_applications: pendingMentorApplications,
      },
      growth: {
        new_users: newUsers,
        new_courses: newCourses,
        new_enrollments: newEnrollments,
        recent_revenue: recentRevenue._sum?.total_amount || 0,
      },
    };
  }

  /**
   * Get user management list
   */
  async getUserManagement(
    filters: {
      page?: number;
      limit?: number;
      search?: string;
      role?: UserRole;
      status?: UserStatus;
    } = {}
  ) {
    const { page = 1, limit = 20, search, role, status } = filters;

    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          email: true,
          full_name: true,
          role: true,
          status: true,
          avatar_url: true,
          email_verified: true,
          last_login: true,
          created_at: true,
          _count: {
            select: {
              enrollments: true,
              reviews: true,
              transactions: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update user status
   */
  async updateUserStatus(userId: string, status: UserStatus, reason?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status },
    });

    // Log the action (you might want to create an admin_actions table)
    console.log(
      `User ${userId} status updated to ${status}. Reason: ${reason}`
    );

    return updated;
  }

  /**
   * Create new admin user
   */
  async createAdminUser(data: {
    email: string;
    password: string;
    full_name: string;
  }) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError("User already exists", HTTP_STATUS.CONFLICT);
    }

    const hashedPassword = await hashPassword(data.password);

    const adminUser = await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        role: "ADMIN" as UserRole,
        status: "ACTIVE" as UserStatus,
        email_verified: true,
        email_verified_at: new Date(),
      },
    });

    return {
      id: adminUser.id,
      email: adminUser.email,
      full_name: adminUser.full_name,
      role: adminUser.role,
      status: adminUser.status,
    };
  }

  /**
   * Get system health
   */
  async getSystemHealth() {
    // Check database connection
    let dbStatus = "healthy";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      dbStatus = "unhealthy";
    }

    // Check Redis connection (if using Redis)
    let redisStatus = "healthy";
    // ... redis check implementation

    // Check storage (if using S3 or similar)
    let storageStatus = "healthy";
    // ... storage check implementation

    return {
      database: dbStatus,
      redis: redisStatus,
      storage: storageStatus,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get revenue statistics
   */
  async getRevenueStatistics(dateRange?: { start: Date; end: Date }) {
    const where: Prisma.TransactionWhereInput = {
      status: "PAID",
    };

    if (dateRange) {
      where.paid_at = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }

    const [transactions, revenueByDate, revenueByCourse] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          course: {
            select: {
              title: true,
            },
          },
          user: {
            select: {
              full_name: true,
            },
          },
        },
        orderBy: { paid_at: "desc" },
      }),
      prisma.transaction.groupBy({
        by: ["paid_at"],
        where,
        _sum: {
          total_amount: true,
        },
        orderBy: {
          paid_at: "asc",
        },
      }),
      prisma.transaction.groupBy({
        by: ["course_id"],
        where,
        _sum: {
          total_amount: true,
        },
        _count: {
          id: true,
        },
        orderBy: {
          _sum: {
            total_amount: "desc",
          },
        },
        take: 10,
      }),
    ]);

    // Get course details for revenue by course
    const courseRevenue = await Promise.all(
      revenueByCourse.map(async (item) => {
        const course = await prisma.course.findUnique({
          where: { id: item.course_id },
          select: {
            title: true,
            mentor: {
              select: {
                user: {
                  select: {
                    full_name: true,
                  },
                },
              },
            },
          },
        });

        return {
          course_id: item.course_id,
          course_title: course?.title,
          mentor_name: course?.mentor.user.full_name,
          revenue: item._sum.total_amount || 0,
          enrollments: item._count.id,
        };
      })
    );

    return {
      transactions,
      revenue_by_date: revenueByDate,
      revenue_by_course: courseRevenue,
    };
  }

  /**
   * Get course management list
   */
  async getCourseManagement(
    filters: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      mentorId?: string;
    } = {}
  ) {
    const { page = 1, limit = 20, search, status, mentorId } = filters;

    const skip = (page - 1) * limit;

    const where: Prisma.CourseWhereInput = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status as any;
    }

    if (mentorId) {
      where.mentor_id = mentorId;
    }

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          category: true,
          mentor: {
            include: {
              user: {
                select: {
                  full_name: true,
                  email: true,
                },
              },
            },
          },
          _count: {
            select: {
              enrollments: true,
              reviews: true,
            },
          },
        },
      }),
      prisma.course.count({ where }),
    ]);

    return {
      data: courses,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update course status
   */
  async updateCourseStatus(courseId: string, status: string, reason?: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundError("Course not found");
    }

    const updated = await prisma.course.update({
      where: { id: courseId },
      data: { status: status as any },
    });

    // Notify mentor about course status change
    if (course.status !== status) {
      // ... notification logic
    }

    return updated;
  }

  /**
   * Get mentor applications
   */
  async getMentorApplications(
    filters: {
      page?: number;
      limit?: number;
      status?: string;
    } = {}
  ) {
    const { page = 1, limit = 20, status } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.MentorProfileWhereInput = {};
    if (status) {
      where.status = status as any;
    }

    const [applications, total] = await Promise.all([
      prisma.mentorProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              full_name: true,
              avatar_url: true,
              created_at: true,
            },
          },
        },
      }),
      prisma.mentorProfile.count({ where }),
    ]);

    return {
      data: applications,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Approve mentor application
   */
  async approveMentor(mentorProfileId: string) {
    const mentorProfile = await prisma.mentorProfile.findUnique({
      where: { id: mentorProfileId },
      include: { user: true },
    });

    if (!mentorProfile) {
      throw new NotFoundError("Mentor application not found");
    }

    const updated = await prisma.$transaction([
      prisma.mentorProfile.update({
        where: { id: mentorProfileId },
        data: {
          status: "APPROVED",
          approved_at: new Date(),
        },
      }),
      prisma.user.update({
        where: { id: mentorProfile.user_id },
        data: { role: "MENTOR" as UserRole },
      }),
    ]);

    return updated[0];
  }

  /**
   * Reject mentor application
   */
  async rejectMentor(mentorProfileId: string, reason: string) {
    const mentorProfile = await prisma.mentorProfile.findUnique({
      where: { id: mentorProfileId },
    });

    if (!mentorProfile) {
      throw new NotFoundError("Mentor application not found");
    }

    const updated = await prisma.mentorProfile.update({
      where: { id: mentorProfileId },
      data: {
        status: "REJECTED",
        rejected_at: new Date(),
        rejection_reason: reason,
      },
    });

    return updated;
  }
}

const adminService = new AdminService();
export default adminService;
