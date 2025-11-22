import prisma from "@/lib/prisma";
import { generateSlug } from "@/utils/string.util";
import { AppError, NotFoundError, ForbiddenError } from "@/utils/error.util";
import { HTTP_STATUS, COURSE_STATUS, USER_ROLES } from "@/lib/constants";

/**
 * Course Creation Data
 */
interface CreateCourseData {
  title: string;
  description: string;
  shortDescription?: string;
  categoryId: string;
  level: string;
  language: string;
  price: number;
  discountPrice?: number;
  isFree: boolean;
  isPremium: boolean;
  requirements?: string[];
  whatYouWillLearn: string[];
  targetAudience?: string[];
  tags?: string[];
}

/**
 * Course Update Data
 */
type UpdateCourseData = Partial<CreateCourseData> & {
  thumbnail?: string;
  coverImage?: string;
};

/**
 * Course List Filters
 */
interface CourseListFilters {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  level?: string;
  minPrice?: number;
  maxPrice?: number;
  isFree?: boolean;
  isPremium?: boolean;
  status?: string;
  mentorId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Course Service
 * Handles course CRUD operations and management
 */
export class CourseService {
  /**
   * Create new course
   */
  async createCourse(mentorUserId: string, data: CreateCourseData) {
    // Get mentor profile
    const mentor = await prisma.mentorProfile.findUnique({
      where: { user_id: mentorUserId },
    });

    if (!mentor) {
      throw new ForbiddenError("Only approved mentors can create courses");
    }

    if (mentor.status !== "APPROVED") {
      throw new ForbiddenError("Your mentor profile must be approved first");
    }

    // Generate slug
    let slug = generateSlug(data.title);

    // Ensure unique slug
    const existingCourse = await prisma.course.findUnique({
      where: { slug },
    });

    if (existingCourse) {
      slug = `${slug}-${Date.now()}`;
    }

    // Create course
    const course = await prisma.course.create({
      data: {
        mentor_id: mentor.id,
        title: data.title,
        slug,
        description: data.description,
        short_description: data.shortDescription,
        category_id: data.categoryId,
        level: data.level,
        language: data.language,
        price: data.price,
        discount_price: data.discountPrice,
        is_free: data.isFree,
        is_premium: data.isPremium,
        requirements: data.requirements || [],
        what_you_will_learn: data.whatYouWillLearn,
        target_audience: data.targetAudience || [],
        tags: data.tags || [],
        status: COURSE_STATUS.DRAFT,
      },
      include: {
        category: true,
        mentor: {
          include: {
            user: {
              select: {
                full_name: true,
                email: true,
                avatar_url: true,
              },
            },
          },
        },
      },
    });

    return course;
  }

  /**
   * Get all courses with filters
   */
  async getAllCourses(filters: CourseListFilters = {}) {
    const {
      page = 1,
      limit = 10,
      search,
      categoryId,
      level,
      minPrice,
      maxPrice,
      isFree,
      isPremium,
      status,
      mentorId,
      sortBy = "created_at",
      sortOrder = "desc",
    } = filters;

    // Build where clause
    const where: any = {};

    // Only show published courses for public
    if (!status) {
      where.status = COURSE_STATUS.PUBLISHED;
    } else {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { has: search.toLowerCase() } },
      ];
    }

    if (categoryId) {
      where.category_id = categoryId;
    }

    if (level) {
      where.level = level;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    if (isFree !== undefined) {
      where.is_free = isFree;
    }

    if (isPremium !== undefined) {
      where.is_premium = isPremium;
    }

    if (mentorId) {
      where.mentor_id = mentorId;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute queries
    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnail: true,
          short_description: true,
          level: true,
          language: true,
          price: true,
          discount_price: true,
          is_free: true,
          is_premium: true,
          is_featured: true,
          status: true,
          total_students: true,
          average_rating: true,
          total_reviews: true,
          total_duration: true,
          total_lectures: true,
          published_at: true,
          created_at: true,
          category: {
            select: {
              name: true,
              slug: true,
            },
          },
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
   * Get course by ID with full details
   */
  async getCourseById(courseId: string, includePrivate = false) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        category: true,
        mentor: {
          include: {
            user: {
              select: {
                full_name: true,
                email: true,
                avatar_url: true,
                bio: true,
              },
            },
          },
        },
        sections: {
          orderBy: { order: "asc" },
          include: {
            materials: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                title: true,
                type: true,
                duration: true,
                order: true,
                is_free: true,
              },
            },
          },
        },
        _count: {
          select: {
            sections: true,
            enrollments: true,
            reviews: true,
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundError("Course not found");
    }

    // Check if course is published (unless requesting private access)
    if (!includePrivate && course.status !== COURSE_STATUS.PUBLISHED) {
      throw new ForbiddenError("Course is not available");
    }

    return course;
  }

  /**
   * Get course by slug
   */
  async getCourseBySlug(slug: string, includePrivate = false) {
    const course = await prisma.course.findUnique({
      where: { slug },
      include: {
        category: true,
        mentor: {
          include: {
            user: {
              select: {
                full_name: true,
                email: true,
                avatar_url: true,
                bio: true,
              },
            },
          },
        },
        sections: {
          orderBy: { order: "asc" },
          include: {
            materials: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                title: true,
                type: true,
                duration: true,
                order: true,
                is_free: true,
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundError("Course not found");
    }

    if (!includePrivate && course.status !== COURSE_STATUS.PUBLISHED) {
      throw new ForbiddenError("Course is not available");
    }

    // Increment view count
    await prisma.course.update({
      where: { id: course.id },
      data: { total_views: { increment: 1 } },
    });

    return course;
  }

  /**
   * Update course
   */
  async updateCourse(
    courseId: string,
    userId: string,
    userRole: string,
    data: UpdateCourseData
  ) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { mentor: true },
    });

    if (!course) {
      throw new NotFoundError("Course not found");
    }

    // Check permission (only mentor owner or admin)
    if (userRole !== USER_ROLES.ADMIN && course.mentor.user_id !== userId) {
      throw new ForbiddenError(
        "You do not have permission to update this course"
      );
    }

    // Build update data manually to handle field name conversions
    const updateData: any = {};

    // Handle title and slug if title changed
    if (data.title && data.title !== course.title) {
      updateData.title = data.title;
      let newSlug = generateSlug(data.title);

      // Check slug uniqueness
      const existingCourse = await prisma.course.findFirst({
        where: { slug: newSlug, NOT: { id: courseId } },
      });

      if (existingCourse) {
        newSlug = `${newSlug}-${Date.now()}`;
      }

      updateData.slug = newSlug;
    }

    // Handle category using relation
    if (data.categoryId !== undefined) {
      updateData.category = {
        connect: { id: data.categoryId },
      };
    }

    // Handle other fields
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.shortDescription !== undefined)
      updateData.short_description = data.shortDescription;
    if (data.level !== undefined) updateData.level = data.level;
    if (data.language !== undefined) updateData.language = data.language;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.discountPrice !== undefined)
      updateData.discount_price = data.discountPrice;
    if (data.isFree !== undefined) updateData.is_free = data.isFree;
    if (data.isPremium !== undefined) updateData.is_premium = data.isPremium;
    if (data.requirements !== undefined)
      updateData.requirements = data.requirements;
    if (data.whatYouWillLearn !== undefined)
      updateData.what_you_will_learn = data.whatYouWillLearn;
    if (data.targetAudience !== undefined)
      updateData.target_audience = data.targetAudience;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.thumbnail !== undefined) updateData.thumbnail = data.thumbnail;
    if (data.coverImage !== undefined) updateData.cover_image = data.coverImage;

    const updated = await prisma.course.update({
      where: { id: courseId },
      data: updateData,
      include: {
        category: true,
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
    });

    return updated;
  }

  /**
   * Delete course
   */
  async deleteCourse(courseId: string, userId: string, userRole: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { mentor: true },
    });

    if (!course) {
      throw new NotFoundError("Course not found");
    }

    // Check permission
    if (userRole !== USER_ROLES.ADMIN && course.mentor.user_id !== userId) {
      throw new ForbiddenError(
        "You do not have permission to delete this course"
      );
    }

    // Check if course has enrollments
    const enrollmentCount = await prisma.enrollment.count({
      where: { course_id: courseId },
    });

    if (enrollmentCount > 0) {
      throw new AppError(
        "Cannot delete course with active enrollments. Archive it instead.",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    await prisma.course.delete({
      where: { id: courseId },
    });

    return { id: courseId, deleted: true };
  }

  /**
   * Publish course
   */
  async publishCourse(courseId: string, userId: string, userRole: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { mentor: true, sections: { include: { materials: true } } },
    });

    if (!course) {
      throw new NotFoundError("Course not found");
    }

    // Check permission
    if (userRole !== USER_ROLES.ADMIN && course.mentor.user_id !== userId) {
      throw new ForbiddenError(
        "You do not have permission to publish this course"
      );
    }

    // Validation: Course must have sections and materials
    if (course.sections.length === 0) {
      throw new AppError(
        "Course must have at least one section",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const totalMaterials = course.sections.reduce(
      (sum: number, section: any) => sum + section.materials.length,
      0
    );

    if (totalMaterials === 0) {
      throw new AppError(
        "Course must have at least one material",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Update status to published
    const updated = await prisma.course.update({
      where: { id: courseId },
      data: {
        status: COURSE_STATUS.PUBLISHED,
        published_at: new Date(),
      },
    });

    return updated;
  }

  /**
   * Archive course
   */
  async archiveCourse(courseId: string, userId: string, userRole: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { mentor: true },
    });

    if (!course) {
      throw new NotFoundError("Course not found");
    }

    // Check permission
    if (userRole !== USER_ROLES.ADMIN && course.mentor.user_id !== userId) {
      throw new ForbiddenError(
        "You do not have permission to archive this course"
      );
    }

    const updated = await prisma.course.update({
      where: { id: courseId },
      data: { status: COURSE_STATUS.ARCHIVED },
    });

    return updated;
  }

  /**
   * Get course statistics
   */
  async getCourseStatistics(courseId: string) {
    const [course, enrollmentStats, revenueStats] = await Promise.all([
      prisma.course.findUnique({
        where: { id: courseId },
        select: {
          total_students: true,
          average_rating: true,
          total_reviews: true,
          total_views: true,
        },
      }),

      prisma.enrollment.groupBy({
        by: ["status"],
        where: { course_id: courseId },
        _count: true,
      }),

      prisma.transaction.aggregate({
        where: {
          course_id: courseId,
          status: "PAID",
        },
        _sum: { total_amount: true },
        _count: true,
      }),
    ]);

    if (!course) {
      throw new NotFoundError("Course not found");
    }

    return {
      ...course,
      enrollments: Object.fromEntries(
        enrollmentStats.map((stat: any) => [stat.status, stat._count])
      ),
      revenue: {
        total: revenueStats._sum?.total_amount || 0,
        transactions: revenueStats._count || 0,
      },
    };
  }
}

const courseService = new CourseService();
export default courseService;
