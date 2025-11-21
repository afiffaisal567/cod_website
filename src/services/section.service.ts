import prisma from "@/lib/prisma";
import { NotFoundError, ForbiddenError, AppError } from "@/utils/error.util";
import { HTTP_STATUS, USER_ROLES } from "@/lib/constants";

/**
 * Section Creation Data
 */
interface CreateSectionData {
  courseId: string;
  title: string;
  description?: string;
  order?: number;
}

/**
 * Section Update Data
 */
interface UpdateSectionData {
  title?: string;
  description?: string;
  order?: number;
}

/**
 * Section Reorder Data
 */
interface ReorderSectionData {
  id: string;
  order: number;
}

/**
 * Section Service
 * Handles course section operations
 */
export class SectionService {
  /**
   * Create new section
   */
  async createSection(
    userId: string,
    userRole: string,
    data: CreateSectionData
  ) {
    // Check course ownership
    const course = await prisma.course.findUnique({
      where: { id: data.courseId },
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
        where: { course_id: data.courseId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      order = (lastSection?.order ?? -1) + 1;
    }

    // Create section
    const section = await prisma.section.create({
      data: {
        course_id: data.courseId,
        title: data.title,
        description: data.description,
        order,
      },
      include: {
        materials: {
          orderBy: { order: "asc" },
        },
      },
    });

    return section;
  }

  /**
   * Get all sections for a course
   */
  async getCourseSections(courseId: string) {
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
        _count: {
          select: {
            materials: true,
          },
        },
      },
    });

    return sections;
  }

  /**
   * Get section by ID
   */
  async getSectionById(sectionId: string) {
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        course: {
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
          },
        },
        materials: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!section) {
      throw new NotFoundError("Section not found");
    }

    return section;
  }

  /**
   * Update section
   */
  async updateSection(
    sectionId: string,
    userId: string,
    userRole: string,
    data: UpdateSectionData
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
      include: {
        materials: {
          orderBy: { order: "asc" },
        },
      },
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
        "Cannot delete section with materials. Delete materials first.",
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
   * Reorder sections
   */
  async reorderSections(
    courseId: string,
    userId: string,
    userRole: string,
    sections: ReorderSectionData[]
  ) {
    // Check course ownership
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
        "You do not have permission to reorder sections"
      );
    }

    // Update section orders in transaction
    await prisma.$transaction(
      sections.map((section) =>
        prisma.section.update({
          where: { id: section.id },
          data: { order: section.order },
        })
      )
    );

    // Get updated sections
    return this.getCourseSections(courseId);
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
   * Get section materials
   */
  async getSectionMaterials(sectionId: string) {
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
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
            resources: true,
          },
        },
      },
    });

    if (!section) {
      throw new NotFoundError("Section not found");
    }

    return section.materials;
  }

  /**
   * Calculate section duration
   */
  async calculateSectionDuration(sectionId: string): Promise<number> {
    const materials = await prisma.material.findMany({
      where: { section_id: sectionId },
      select: { duration: true },
    });

    return materials.reduce((total, material) => total + material.duration, 0);
  }

  /**
   * Update section duration
   */
  async updateSectionDuration(sectionId: string) {
    const duration = await this.calculateSectionDuration(sectionId);

    await prisma.section.update({
      where: { id: sectionId },
      data: { duration },
    });

    return duration;
  }
}

const sectionService = new SectionService();
export default sectionService;
