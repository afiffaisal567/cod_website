import prisma from "@/lib/prisma";
import emailService from "./email.service";
import notificationService from "./notification.service";
import { AppError, NotFoundError, ConflictError } from "@/utils/error.util";
import {
  HTTP_STATUS,
  MENTOR_STATUS,
  USER_STATUS,
  USER_ROLES,
} from "@/lib/constants";

/**
 * Mentor Application Data
 */
interface MentorApplicationData {
  expertise: string[];
  experience: number;
  education?: string;
  bio: string;
  headline: string;
  website?: string;
  linkedin?: string;
  twitter?: string;
  portfolio?: string;
}

/**
 * Mentor Profile Update Data
 */
interface MentorProfileUpdateData {
  expertise?: string[];
  experience?: number;
  education?: string;
  bio?: string;
  headline?: string;
  website?: string;
  linkedin?: string;
  twitter?: string;
  portfolio?: string;
}

/**
 * Mentor List Filters
 */
interface MentorListFilters {
  page?: number;
  limit?: number;
  search?: string;
  expertise?: string;
  min_rating?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

/**
 * Mentor Service
 * Handles mentor application, management, and profile operations
 */
export class MentorService {
  /**
   * Apply to become a mentor
   */
  async applyAsMentor(user_id: string, data: MentorApplicationData) {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: user_id },
      include: { mentor_profile: true },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Check if already a mentor or has pending application
    if (user.mentor_profile) {
      if (user.mentor_profile.status === MENTOR_STATUS.APPROVED) {
        throw new ConflictError("You are already an approved mentor");
      }
      if (user.mentor_profile.status === MENTOR_STATUS.PENDING) {
        throw new ConflictError(
          "You already have a pending mentor application"
        );
      }
    }

    // Create or update mentor profile
    const mentorProfile = await prisma.mentorProfile.upsert({
      where: { user_id },
      update: {
        ...data,
        status: MENTOR_STATUS.PENDING,
        rejected_at: null,
        rejection_reason: null,
      },
      create: {
        user_id,
        ...data,
        status: MENTOR_STATUS.PENDING,
      },
    });

    // Send notification to admin
    const admins = await prisma.user.findMany({
      where: { role: USER_ROLES.ADMIN, status: USER_STATUS.ACTIVE },
    });

    for (const admin of admins) {
      await notificationService.create(
        admin.id,
        "SYSTEM_ANNOUNCEMENT",
        "New Mentor Application",
        `${user.full_name} has applied to become a mentor`,
        { user_id, mentor_profile_id: mentorProfile.id }
      );
    }

    return {
      id: mentorProfile.id,
      status: mentorProfile.status,
      message: "Your mentor application has been submitted successfully",
    };
  }

  /**
   * Get all mentors with filters
   */
  async getAllMentors(filters: MentorListFilters) {
    const {
      page = 1,
      limit = 10,
      search,
      expertise,
      min_rating,
      sort_by = "created_at",
      sort_order = "desc",
    } = filters;

    // Build where clause
    const where: any = {
      status: MENTOR_STATUS.APPROVED,
      user: { status: USER_STATUS.ACTIVE },
    };

    if (search) {
      where.OR = [
        { user: { full_name: { contains: search, mode: "insensitive" } } },
        { headline: { contains: search, mode: "insensitive" } },
        { bio: { contains: search, mode: "insensitive" } },
      ];
    }

    if (expertise) {
      where.expertise = { has: expertise };
    }

    if (min_rating) {
      where.average_rating = { gte: min_rating };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute queries
    const [mentors, total] = await Promise.all([
      prisma.mentorProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort_by]: sort_order },
        select: {
          id: true,
          expertise: true,
          experience: true,
          headline: true,
          bio: true,
          average_rating: true,
          total_students: true,
          total_courses: true,
          total_reviews: true,
          created_at: true,
          user: {
            select: {
              id: true,
              full_name: true,
              email: true,
              avatar_url: true,
            },
          },
        },
      }),
      prisma.mentorProfile.count({ where }),
    ]);

    return {
      data: mentors,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get mentor by ID with full details
   */
  async getMentorById(mentor_id: string) {
    const mentor = await prisma.mentorProfile.findUnique({
      where: { id: mentor_id },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            email: true,
            avatar_url: true,
            bio: true,
            created_at: true,
          },
        },
        courses: {
          where: { status: "PUBLISHED" },
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnail: true,
            level: true,
            price: true,
            average_rating: true,
            total_students: true,
            created_at: true,
          },
          take: 6,
          orderBy: { created_at: "desc" },
        },
      },
    });

    if (!mentor) {
      throw new NotFoundError("Mentor not found");
    }

    return mentor;
  }

  /**
   * Get mentor profile by user ID
   */
  async getMentorByUserId(user_id: string) {
    const mentor = await prisma.mentorProfile.findUnique({
      where: { user_id },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            email: true,
            avatar_url: true,
          },
        },
      },
    });

    if (!mentor) {
      throw new NotFoundError("Mentor profile not found");
    }

    return mentor;
  }

  /**
   * Update mentor profile
   */
  async updateMentorProfile(user_id: string, data: MentorProfileUpdateData) {
    const mentor = await prisma.mentorProfile.findUnique({
      where: { user_id },
    });

    if (!mentor) {
      throw new NotFoundError("Mentor profile not found");
    }

    if (mentor.status !== MENTOR_STATUS.APPROVED) {
      throw new AppError(
        "Only approved mentors can update their profile",
        HTTP_STATUS.FORBIDDEN
      );
    }

    const updated = await prisma.mentorProfile.update({
      where: { user_id },
      data,
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            email: true,
            avatar_url: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Approve mentor application
   */
  async approveMentor(mentor_id: string, admin_id: string) {
    const mentor = await prisma.mentorProfile.findUnique({
      where: { id: mentor_id },
      include: { user: true },
    });

    if (!mentor) {
      throw new NotFoundError("Mentor application not found");
    }

    if (mentor.status !== MENTOR_STATUS.PENDING) {
      throw new AppError(
        "Only pending applications can be approved",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Update mentor status and user role
    await prisma.$transaction([
      prisma.mentorProfile.update({
        where: { id: mentor_id },
        data: {
          status: MENTOR_STATUS.APPROVED,
          approved_at: new Date(),
        },
      }),
      prisma.user.update({
        where: { id: mentor.user_id },
        data: { role: USER_ROLES.MENTOR },
      }),
    ]);

    // Send notification to user
    await notificationService.notifyMentorApproved(mentor.user_id);

    // Send email
    await emailService.sendMentorApprovedEmail(
      mentor.user.email,
      mentor.user.full_name
    );

    return { id: mentor_id, status: MENTOR_STATUS.APPROVED };
  }

  /**
   * Reject mentor application
   */
  async rejectMentor(mentor_id: string, reason: string, admin_id: string) {
    const mentor = await prisma.mentorProfile.findUnique({
      where: { id: mentor_id },
      include: { user: true },
    });

    if (!mentor) {
      throw new NotFoundError("Mentor application not found");
    }

    if (mentor.status !== MENTOR_STATUS.PENDING) {
      throw new AppError(
        "Only pending applications can be rejected",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Update mentor status
    await prisma.mentorProfile.update({
      where: { id: mentor_id },
      data: {
        status: MENTOR_STATUS.REJECTED,
        rejected_at: new Date(),
        rejection_reason: reason,
      },
    });

    // Send notification to user
    await notificationService.notifyMentorRejected(mentor.user_id, reason);

    // Send email
    await emailService.sendMentorRejectedEmail(
      mentor.user.email,
      mentor.user.full_name,
      reason
    );

    return { id: mentor_id, status: MENTOR_STATUS.REJECTED };
  }

  /**
   * Get mentor statistics
   */
  async getMentorStatistics(user_id: string) {
    const mentor = await prisma.mentorProfile.findUnique({
      where: { user_id },
    });

    if (!mentor) {
      throw new NotFoundError("Mentor profile not found");
    }

    const [total_courses, total_students, total_revenue, recent_enrollments] =
      await Promise.all([
        prisma.course.count({
          where: { mentor_id: mentor.id },
        }),
        prisma.enrollment.count({
          where: {
            course: { mentor_id: mentor.id },
          },
        }),
        prisma.transaction.aggregate({
          where: {
            status: "PAID",
            course: { mentor_id: mentor.id },
          },
          _sum: { total_amount: true },
        }),
        prisma.enrollment.count({
          where: {
            course: { mentor_id: mentor.id },
            created_at: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
        }),
      ]);

    return {
      total_courses,
      total_students,
      total_revenue: total_revenue._sum?.total_amount || 0,
      recent_enrollments,
      average_rating: mentor.average_rating,
      total_reviews: mentor.total_reviews,
    };
  }

  /**
   * Get mentor reviews
   */
  async getMentorReviews(
    mentor_id: string,
    options: { page?: number; limit?: number } = {}
  ) {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: {
          course: { mentor_id },
        },
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          rating: true,
          comment: true,
          is_anonymous: true,
          created_at: true,
          user: {
            select: {
              full_name: true,
              avatar_url: true,
            },
          },
          course: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
      prisma.review.count({
        where: {
          course: { mentor_id },
        },
      }),
    ]);

    return {
      data: reviews,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get pending mentor applications
   */
  async getPendingApplications(
    options: { page?: number; limit?: number } = {}
  ) {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const [applications, total] = await Promise.all([
      prisma.mentorProfile.findMany({
        where: { status: MENTOR_STATUS.PENDING },
        skip,
        take: limit,
        orderBy: { created_at: "asc" },
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              email: true,
              avatar_url: true,
              created_at: true,
            },
          },
        },
      }),
      prisma.mentorProfile.count({
        where: { status: MENTOR_STATUS.PENDING },
      }),
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
   * Get mentor dashboard data
   */
  async getMentorDashboard(user_id: string) {
    const mentor = await this.getMentorByUserId(user_id);
    const statistics = await this.getMentorStatistics(user_id);

    // Get recent enrollments with course details
    const recent_enrollments = await prisma.enrollment.findMany({
      where: {
        course: { mentor_id: mentor.id },
      },
      take: 5,
      orderBy: { created_at: "desc" },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            thumbnail: true,
          },
        },
        user: {
          select: {
            id: true,
            full_name: true,
            avatar_url: true,
          },
        },
      },
    });

    // Get recent reviews
    const recent_reviews = await prisma.review.findMany({
      where: {
        course: { mentor_id: mentor.id },
      },
      take: 5,
      orderBy: { created_at: "desc" },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            avatar_url: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return {
      mentor,
      statistics,
      recent_enrollments,
      recent_reviews,
    };
  }

  /**
   * Update mentor revenue
   */
  async updateMentorRevenue(mentor_id: string, amount: number) {
    await prisma.mentorProfile.update({
      where: { id: mentor_id },
      data: {
        total_revenue: {
          increment: amount,
        },
      },
    });
  }

  /**
   * Update mentor rating
   */
  async updateMentorRating(mentor_id: string) {
    const reviews = await prisma.review.findMany({
      where: {
        course: { mentor_id },
      },
      select: {
        rating: true,
      },
    });

    if (reviews.length === 0) {
      return;
    }

    const total_rating = reviews.reduce(
      (sum: number, review: any) => sum + review.rating,
      0
    );
    const average_rating = total_rating / reviews.length;

    await prisma.mentorProfile.update({
      where: { id: mentor_id },
      data: {
        average_rating,
        total_reviews: reviews.length,
      },
    });
  }
}

const mentorService = new MentorService();
export default mentorService;
