import prisma from "@/lib/prisma";
import { generateSlug } from "@/utils/string.util";
import {
  AppError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "@/utils/error.util";
import {
  HTTP_STATUS,
  COURSE_STATUS,
  USER_ROLES,
  COURSE_LEVEL,
} from "@/lib/constants";

// Type definitions untuk Prisma
interface SectionWithMaterials {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  duration: number;
  course_id: string;
  created_at: Date;
  updated_at: Date;
  materials: Array<{
    id: string;
    title: string;
    type: string;
    duration: number | null;
    order: number;
    is_free: boolean;
    description?: string | null;
    video?: any;
    resources?: any[];
    progress?: any[];
  }>;
}

interface EnrollmentWithProgress {
  id: string;
  user_id: string;
  course_id: string;
  status: string;
  progress: number;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  progress_records: Array<{
    material_id: string;
    is_completed: boolean;
  }>;
}

interface ReviewWithRating {
  rating: number;
}

interface EnrollmentStats {
  status: string;
  _count: number;
}

interface CourseWithSections {
  id: string;
  title: string;
  description: string;
  slug: string;
  status: string;
  mentor_id: string;
  mentor: {
    user_id: string;
  };
  sections: SectionWithMaterials[];
}

/**
 * Course Creation Data
 */
export interface CreateCourseData {
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
  thumbnail?: string;
  coverImage?: string;
}

/**
 * Course Update Data
 */
export interface UpdateCourseData {
  title?: string;
  description?: string;
  shortDescription?: string;
  categoryId?: string;
  level?: string;
  language?: string;
  price?: number;
  discountPrice?: number | null;
  isFree?: boolean;
  isPremium?: boolean;
  requirements?: string[];
  whatYouWillLearn?: string[];
  targetAudience?: string[];
  tags?: string[];
  thumbnail?: string;
  coverImage?: string;
  isFeatured?: boolean;
}

/**
 * Course List Filters
 */
export interface CourseListFilters {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  level?: string;
  minPrice?: number;
  maxPrice?: number;
  isFree?: boolean;
  isPremium?: boolean;
  isFeatured?: boolean;
  status?: string;
  mentorId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  userId?: string;
}

/**
 * Review Data
 */
export interface CreateReviewData {
  rating: number;
  comment?: string;
  isAnonymous?: boolean;
}

/**
 * Section Data
 */
export interface CreateSectionData {
  title: string;
  description?: string;
  order?: number;
}

/**
 * Material Data
 */
export interface CreateMaterialData {
  title: string;
  description?: string;
  type: string;
  content?: string;
  documentUrl?: string;
  duration?: number;
  order?: number;
  isFree?: boolean;
}

/**
 * Course Service
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

    // Validate category
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    });

    if (!category) {
      throw new NotFoundError("Category not found");
    }

    // Validate language - set default if not provided
    const language = data.language || "id";

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
        language: language,
        price: data.price,
        discount_price: data.discountPrice,
        is_free: data.isFree,
        is_premium: data.isPremium,
        requirements: data.requirements || [],
        what_you_will_learn: data.whatYouWillLearn,
        target_audience: data.targetAudience || [],
        tags: data.tags || [],
        thumbnail: data.thumbnail,
        cover_image: data.coverImage,
        status: COURSE_STATUS.DRAFT,
      },
      include: {
        category: true,
        mentor: {
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
      isFeatured,
      status,
      mentorId,
      sortBy = "created_at",
      sortOrder = "desc",
      userId,
    } = filters;

    // Build where clause
    const where: any = {};

    // Only show published courses for public (unless status filter is provided)
    if (!status && !mentorId) {
      where.status = COURSE_STATUS.PUBLISHED;
    } else if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { short_description: { contains: search, mode: "insensitive" } },
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

    if (isFeatured !== undefined) {
      where.is_featured = isFeatured;
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
              id: true,
              name: true,
              slug: true,
            },
          },
          mentor: {
            select: {
              user: {
                select: {
                  id: true,
                  full_name: true,
                  avatar_url: true,
                },
              },
            },
          },
          // Include enrollment status if userId provided
          ...(userId && {
            enrollments: {
              where: { user_id: userId },
              select: {
                status: true,
                progress: true,
              },
            },
          }),
        },
      }),
      prisma.course.count({ where }),
    ]);

    // Transform data to include enrollment status
    const transformedCourses = courses.map((course) => ({
      ...course,
      enrollment: (course as any).enrollments?.[0] || null,
      enrollments: undefined, // Remove enrollments array
    }));

    return {
      data: transformedCourses,
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
  async getCourseById(
    courseId: string,
    includePrivate = false,
    userId?: string
  ) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        category: true,
        mentor: {
          include: {
            user: {
              select: {
                id: true,
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
                description: true,
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
        // Include enrollment if userId provided
        ...(userId && {
          enrollments: {
            where: { user_id: userId },
            select: {
              id: true,
              status: true,
              progress: true,
              completed_at: true,
            },
          },
        }),
      },
    });

    if (!course) {
      throw new NotFoundError("Course not found");
    }

    // Check if course is published (unless requesting private access)
    if (!includePrivate && course.status !== COURSE_STATUS.PUBLISHED) {
      throw new ForbiddenError("Course is not available");
    }

    // Transform to include enrollment
    const transformedCourse = {
      ...course,
      enrollment: (course as any).enrollments?.[0] || null,
      enrollments: undefined, // Remove enrollments array
    };

    return transformedCourse;
  }

  /**
   * Get course by slug
   */
  async getCourseBySlug(slug: string, includePrivate = false, userId?: string) {
    const course = await prisma.course.findUnique({
      where: { slug },
      include: {
        category: true,
        mentor: {
          include: {
            user: {
              select: {
                id: true,
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
                description: true,
              },
            },
          },
        },
        reviews: {
          include: {
            user: {
              select: {
                full_name: true,
                avatar_url: true,
              },
            },
          },
          orderBy: { created_at: "desc" },
          take: 10,
        },
        _count: {
          select: {
            sections: true,
            enrollments: true,
            reviews: true,
          },
        },
        ...(userId && {
          enrollments: {
            where: { user_id: userId },
            select: {
              id: true,
              status: true,
              progress: true,
              completed_at: true,
            },
          },
        }),
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

    // Transform to include enrollment
    const transformedCourse = {
      ...course,
      enrollment: (course as any).enrollments?.[0] || null,
      enrollments: undefined, // Remove enrollments array
    };

    return transformedCourse;
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

    // Build update data
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

    // Handle category
    if (data.categoryId !== undefined) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId },
      });
      if (!category) {
        throw new NotFoundError("Category not found");
      }
      updateData.category_id = data.categoryId;
    }

    // Handle discountPrice - convert null to undefined for Prisma
    if (data.discountPrice !== undefined) {
      updateData.discount_price =
        data.discountPrice === null ? undefined : data.discountPrice;
    }

    // Handle other fields
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.shortDescription !== undefined)
      updateData.short_description = data.shortDescription;
    if (data.level !== undefined) updateData.level = data.level;
    if (data.language !== undefined) updateData.language = data.language;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.isFree !== undefined) updateData.is_free = data.isFree;
    if (data.isPremium !== undefined) updateData.is_premium = data.isPremium;
    if (data.isFeatured !== undefined) updateData.is_featured = data.isFeatured;
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
        _count: {
          select: {
            sections: true,
            enrollments: true,
            reviews: true,
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
      include: {
        mentor: true,
        sections: {
          include: {
            materials: true,
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundError("Course not found");
    }

    // Check permission
    if (
      userRole !== USER_ROLES.ADMIN &&
      (course as CourseWithSections).mentor.user_id !== userId
    ) {
      throw new ForbiddenError(
        "You do not have permission to publish this course"
      );
    }

    // Validation: Course must have sections and materials
    if ((course as CourseWithSections).sections.length === 0) {
      throw new AppError(
        "Course must have at least one section",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const totalMaterials = (course as CourseWithSections).sections.reduce(
      (sum: number, section: SectionWithMaterials) =>
        sum + section.materials.length,
      0
    );

    if (totalMaterials === 0) {
      throw new AppError(
        "Course must have at least one material",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Calculate total duration
    const totalDuration = (course as CourseWithSections).sections.reduce(
      (sum: number, section: SectionWithMaterials) =>
        sum + (section.duration || 0),
      0
    );

    const totalLectures = (course as CourseWithSections).sections.reduce(
      (sum: number, section: SectionWithMaterials) =>
        sum + section.materials.length,
      0
    );

    // Update status to published
    const updated = await prisma.course.update({
      where: { id: courseId },
      data: {
        status: COURSE_STATUS.PUBLISHED,
        published_at: new Date(),
        total_duration: totalDuration,
        total_lectures: totalLectures,
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
   * Enroll in course
   */
  async enrollCourse(courseId: string, userId: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundError("Course not found");
    }

    if (course.status !== COURSE_STATUS.PUBLISHED) {
      throw new ForbiddenError("Course is not available for enrollment");
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        user_id_course_id: {
          user_id: userId,
          course_id: courseId,
        },
      },
    });

    if (existingEnrollment) {
      if (existingEnrollment.status === "ACTIVE") {
        throw new ConflictError("You are already enrolled in this course");
      } else if (existingEnrollment.status === "COMPLETED") {
        throw new ConflictError("You have already completed this course");
      }
    }

    // Create enrollment
    const enrollment = await prisma.enrollment.create({
      data: {
        user_id: userId,
        course_id: courseId,
        status: "ACTIVE",
        progress: 0,
      },
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
    });

    // Update course student count
    await prisma.course.update({
      where: { id: courseId },
      data: {
        total_students: {
          increment: 1,
        },
      },
    });

    // Update mentor student count
    await prisma.mentorProfile.update({
      where: { id: course.mentor_id },
      data: {
        total_students: {
          increment: 1,
        },
      },
    });

    return enrollment;
  }

  /**
   * Get course materials
   */
  async getCourseMaterials(courseId: string, userId?: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            materials: {
              orderBy: { order: "asc" },
              include: {
                video: {
                  select: {
                    id: true,
                    filename: true,
                    duration: true,
                    thumbnail: true,
                    status: true,
                  },
                },
                resources: {
                  orderBy: { created_at: "asc" },
                },
                // Include progress if userId provided
                ...(userId && {
                  progress: {
                    where: { user_id: userId },
                    select: {
                      is_completed: true,
                      watched_duration: true,
                      last_position: true,
                      completed_at: true,
                    },
                  },
                }),
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundError("Course not found");
    }

    // Transform materials to include progress
    const transformedSections = (course as any).sections.map(
      (section: SectionWithMaterials) => ({
        ...section,
        materials: section.materials.map((material) => ({
          ...material,
          progress: (material as any).progress?.[0] || null,
        })),
      })
    );

    return {
      ...course,
      sections: transformedSections,
    };
  }

  /**
   * Get course reviews
   */
  async getCourseReviews(
    courseId: string,
    options: { page?: number; limit?: number } = {}
  ) {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundError("Course not found");
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { course_id: courseId },
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              avatar_url: true,
            },
          },
        },
      }),
      prisma.review.count({
        where: { course_id: courseId },
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
   * Create review for course
   */
  async createReview(courseId: string, userId: string, data: CreateReviewData) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundError("Course not found");
    }

    // Check if user is enrolled
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        user_id_course_id: {
          user_id: userId,
          course_id: courseId,
        },
      },
    });

    if (!enrollment) {
      throw new ForbiddenError(
        "You must be enrolled in the course to review it"
      );
    }

    // Check if already reviewed
    const existingReview = await prisma.review.findUnique({
      where: {
        user_id_course_id: {
          user_id: userId,
          course_id: courseId,
        },
      },
    });

    if (existingReview) {
      throw new ConflictError("You have already reviewed this course");
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        user_id: userId,
        course_id: courseId,
        rating: data.rating,
        comment: data.comment,
        is_anonymous: data.isAnonymous || false,
      },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            avatar_url: true,
          },
        },
      },
    });

    // Update course rating statistics
    await this.updateCourseRating(courseId);

    return review;
  }

  /**
   * Get course students (for mentor/admin)
   */
  async getCourseStudents(
    courseId: string,
    userId: string,
    userRole: string,
    options: { page?: number; limit?: number } = {}
  ) {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

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
        "You do not have permission to view course students"
      );
    }

    const [enrollments, total] = await Promise.all([
      prisma.enrollment.findMany({
        where: { course_id: courseId },
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
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
          progress_records: {
            select: {
              material_id: true,
              is_completed: true,
            },
          },
        },
      }),
      prisma.enrollment.count({
        where: { course_id: courseId },
      }),
    ]);

    // Transform to include progress
    const transformedEnrollments = enrollments.map(
      (enrollment: EnrollmentWithProgress) => {
        const totalMaterials = course.total_lectures || 0;
        const completedMaterials = enrollment.progress_records.filter(
          (p) => p.is_completed
        ).length;
        const progress =
          totalMaterials > 0 ? (completedMaterials / totalMaterials) * 100 : 0;

        return {
          ...enrollment,
          progress: Math.round(progress),
          completed_materials: completedMaterials,
          total_materials: totalMaterials,
          progress_records: undefined, // Remove progress_records array
        };
      }
    );

    return {
      data: transformedEnrollments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get course sections
   */
  async getCourseSections(courseId: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundError("Course not found");
    }

    const sections = await prisma.section.findMany({
      where: { course_id: courseId },
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
    });

    return sections;
  }

  /**
   * Create section for course
   */
  async createSection(
    courseId: string,
    userId: string,
    userRole: string,
    data: CreateSectionData
  ) {
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
        "You do not have permission to add sections to this course"
      );
    }

    // Get next order number if not provided
    let order = data.order;
    if (order === undefined) {
      const lastSection = await prisma.section.findFirst({
        where: { course_id: courseId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      order = (lastSection?.order ?? -1) + 1;
    }

    // Create section
    const section = await prisma.section.create({
      data: {
        course_id: courseId,
        title: data.title,
        description: data.description,
        order,
      },
    });

    return section;
  }

  /**
   * Update section
   */
  async updateSection(
    sectionId: string,
    userId: string,
    userRole: string,
    data: Partial<CreateSectionData>
  ) {
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        course: {
          include: { mentor: true },
        },
      },
    });

    if (!section) {
      throw new NotFoundError("Section not found");
    }

    // Check permission
    if (
      userRole !== USER_ROLES.ADMIN &&
      section.course.mentor.user_id !== userId
    ) {
      throw new ForbiddenError(
        "You do not have permission to update this section"
      );
    }

    const updated = await prisma.section.update({
      where: { id: sectionId },
      data,
    });

    return updated;
  }

  /**
   * Delete section
   */
  async deleteSection(sectionId: string, userId: string, userRole: string) {
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        course: {
          include: { mentor: true },
        },
        materials: true,
      },
    });

    if (!section) {
      throw new NotFoundError("Section not found");
    }

    // Check permission
    if (
      userRole !== USER_ROLES.ADMIN &&
      section.course.mentor.user_id !== userId
    ) {
      throw new ForbiddenError(
        "You do not have permission to delete this section"
      );
    }

    // Check if section has materials
    if (section.materials.length > 0) {
      throw new AppError(
        "Cannot delete section with materials. Delete the materials first.",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    await prisma.section.delete({
      where: { id: sectionId },
    });

    // Reorder remaining sections
    await this.reorderSectionsAfterDelete(section.course_id, section.order);

    return { id: sectionId, deleted: true };
  }

  /**
   * Get featured courses
   */
  async getFeaturedCourses(limit: number = 10) {
    const courses = await prisma.course.findMany({
      where: {
        status: COURSE_STATUS.PUBLISHED,
        is_featured: true,
      },
      take: limit,
      orderBy: { published_at: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        thumbnail: true,
        short_description: true,
        level: true,
        price: true,
        discount_price: true,
        is_free: true,
        total_students: true,
        average_rating: true,
        total_reviews: true,
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
    });

    return courses;
  }

  /**
   * Get popular courses
   */
  async getPopularCourses(limit: number = 10) {
    const courses = await prisma.course.findMany({
      where: {
        status: COURSE_STATUS.PUBLISHED,
      },
      take: limit,
      orderBy: [{ total_students: "desc" }, { average_rating: "desc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        thumbnail: true,
        short_description: true,
        level: true,
        price: true,
        discount_price: true,
        is_free: true,
        total_students: true,
        average_rating: true,
        total_reviews: true,
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
    });

    return courses;
  }

  /**
   * Get all categories
   */
  async getCategories() {
    const categories = await prisma.category.findMany({
      where: { is_active: true },
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: {
            courses: {
              where: { status: COURSE_STATUS.PUBLISHED },
            },
          },
        },
      },
    });

    return categories;
  }

  /**
   * Get courses by category
   */
  async getCoursesByCategory(
    categorySlug: string,
    options: { page?: number; limit?: number } = {}
  ) {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const category = await prisma.category.findUnique({
      where: { slug: categorySlug },
    });

    if (!category) {
      throw new NotFoundError("Category not found");
    }

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where: {
          category_id: category.id,
          status: COURSE_STATUS.PUBLISHED,
        },
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnail: true,
          short_description: true,
          level: true,
          price: true,
          discount_price: true,
          is_free: true,
          total_students: true,
          average_rating: true,
          total_reviews: true,
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
      prisma.course.count({
        where: {
          category_id: category.id,
          status: COURSE_STATUS.PUBLISHED,
        },
      }),
    ]);

    return {
      data: courses,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        category,
      },
    };
  }

  /**
   * Update course rating statistics
   */
  private async updateCourseRating(courseId: string) {
    const reviews = await prisma.review.findMany({
      where: { course_id: courseId },
      select: { rating: true },
    });

    if (reviews.length === 0) {
      return;
    }

    const totalRating = reviews.reduce(
      (sum: number, review: ReviewWithRating) => sum + review.rating,
      0
    );
    const averageRating = totalRating / reviews.length;

    await prisma.course.update({
      where: { id: courseId },
      data: {
        average_rating: averageRating,
        total_reviews: reviews.length,
      },
    });
  }

  /**
   * Reorder sections after deletion
   */
  private async reorderSectionsAfterDelete(
    courseId: string,
    deletedOrder: number
  ) {
    await prisma.section.updateMany({
      where: {
        course_id: courseId,
        order: { gt: deletedOrder },
      },
      data: {
        order: { decrement: 1 },
      },
    });
  }

  /**
   * Get course statistics
   */
  async getCourseStatistics(
    courseId: string,
    userId: string,
    userRole: string
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
        "You do not have permission to view course statistics"
      );
    }

    const [enrollmentStats, revenueStats, progressStats] = await Promise.all([
      // Enrollment statistics
      prisma.enrollment.groupBy({
        by: ["status"],
        where: { course_id: courseId },
        _count: true,
      }),

      // Revenue statistics
      prisma.transaction.aggregate({
        where: {
          course_id: courseId,
          status: "PAID",
        },
        _sum: { total_amount: true },
        _count: true,
      }),

      // Progress statistics
      prisma.enrollment.aggregate({
        where: { course_id: courseId },
        _avg: { progress: true },
      }),
    ]);

    return {
      course: {
        total_students: course.total_students,
        average_rating: course.average_rating,
        total_reviews: course.total_reviews,
        total_views: course.total_views,
      },
      enrollments: Object.fromEntries(
        (enrollmentStats as EnrollmentStats[]).map((stat) => [
          stat.status,
          stat._count,
        ])
      ),
      revenue: {
        total: revenueStats._sum?.total_amount || 0,
        transactions: revenueStats._count || 0,
      },
      progress: {
        average: progressStats._avg?.progress || 0,
      },
    };
  }
}

// Export singleton instance
const courseService = new CourseService();
export default courseService;
