import prisma from "@/lib/prisma";
import { NotFoundError, ForbiddenError, AppError } from "@/utils/error.util";
import { HTTP_STATUS, USER_ROLES } from "@/lib/constants";

/**
 * Material Creation Data
 */
interface CreateMaterialData {
  section_id: string;
  title: string;
  description?: string;
  type: string;
  content?: string;
  document_url?: string;
  duration?: number;
  order?: number;
  is_free?: boolean;
}

/**
 * Material Update Data
 */
interface UpdateMaterialData {
  title?: string;
  description?: string;
  content?: string;
  document_url?: string;
  duration?: number;
  order?: number;
  is_free?: boolean;
}

/**
 * Material Reorder Data
 */
interface ReorderMaterialData {
  id: string;
  order: number;
}

/**
 * Material Service
 * Handles course material operations
 */
export class MaterialService {
  /**
   * Create new material
   */
  async createMaterial(
    user_id: string,
    user_role: string,
    data: CreateMaterialData
  ) {
    // Check section ownership
    const section = await prisma.section.findUnique({
      where: { id: data.section_id },
      include: {
        course: {
          include: {
            mentor: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!section) {
      throw new NotFoundError("Section not found");
    }

    // Check permission
    if (
      user_role !== USER_ROLES.ADMIN &&
      section.course.mentor.user_id !== user_id
    ) {
      throw new ForbiddenError(
        "You do not have permission to add materials to this section"
      );
    }

    // Get next order number if not provided
    let order = data.order;
    if (order === undefined) {
      const lastMaterial = await prisma.material.findFirst({
        where: { section_id: data.section_id },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      order = (lastMaterial?.order ?? -1) + 1;
    }

    // Create material
    const material = await prisma.material.create({
      data: {
        section_id: data.section_id,
        title: data.title,
        description: data.description,
        type: data.type,
        content: data.content,
        document_url: data.document_url,
        duration: data.duration || 0,
        order,
        is_free: data.is_free || false,
      },
      include: {
        video: true,
        resources: true,
      },
    });

    // Update section duration
    await this.updateSectionDuration(data.section_id);

    return material;
  }

  /**
   * Get material by ID
   */
  async getMaterialById(material_id: string) {
    const material = await prisma.material.findUnique({
      where: { id: material_id },
      include: {
        section: {
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
          },
        },
        video: {
          select: {
            id: true,
            filename: true,
            path: true,
            duration: true,
            thumbnail: true,
            status: true,
            qualities: {
              select: {
                quality: true,
                path: true,
                size: true,
                resolution: true,
              },
            },
          },
        },
        resources: true,
      },
    });

    if (!material) {
      throw new NotFoundError("Material not found");
    }

    return material;
  }

  /**
   * Update material
   */
  async updateMaterial(
    material_id: string,
    user_id: string,
    user_role: string,
    data: UpdateMaterialData
  ) {
    const material = await prisma.material.findUnique({
      where: { id: material_id },
      include: {
        section: {
          include: {
            course: {
              include: {
                mentor: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!material) {
      throw new NotFoundError("Material not found");
    }

    // Check permission
    if (
      user_role !== USER_ROLES.ADMIN &&
      material.section.course.mentor.user_id !== user_id
    ) {
      throw new ForbiddenError(
        "You do not have permission to update this material"
      );
    }

    const updated = await prisma.material.update({
      where: { id: material_id },
      data,
      include: {
        video: true,
        resources: true,
      },
    });

    // Update section duration if duration changed
    if (data.duration !== undefined) {
      await this.updateSectionDuration(material.section_id);
    }

    return updated;
  }

  /**
   * Delete material
   */
  async deleteMaterial(
    material_id: string,
    user_id: string,
    user_role: string
  ) {
    const material = await prisma.material.findUnique({
      where: { id: material_id },
      include: {
        section: {
          include: {
            course: {
              include: {
                mentor: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
        },
        video: true,
        resources: true,
      },
    });

    if (!material) {
      throw new NotFoundError("Material not found");
    }

    // Check permission
    if (
      user_role !== USER_ROLES.ADMIN &&
      material.section.course.mentor.user_id !== user_id
    ) {
      throw new ForbiddenError(
        "You do not have permission to delete this material"
      );
    }

    // Delete associated video if exists
    if (material.video) {
      await prisma.video.delete({
        where: { id: material.video.id },
      });
    }

    // Delete associated resources
    if (material.resources.length > 0) {
      await prisma.resource.deleteMany({
        where: { material_id },
      });
    }

    // Delete material
    await prisma.material.delete({
      where: { id: material_id },
    });

    // Reorder remaining materials
    await this.reorderMaterialsAfterDelete(material.section_id, material.order);

    // Update section duration
    await this.updateSectionDuration(material.section_id);

    return { id: material_id, deleted: true };
  }

  /**
   * Reorder materials
   */
  async reorderMaterials(
    section_id: string,
    user_id: string,
    user_role: string,
    materials: ReorderMaterialData[]
  ) {
    // Check section ownership
    const section = await prisma.section.findUnique({
      where: { id: section_id },
      include: {
        course: {
          include: {
            mentor: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!section) {
      throw new NotFoundError("Section not found");
    }

    // Check permission
    if (
      user_role !== USER_ROLES.ADMIN &&
      section.course.mentor.user_id !== user_id
    ) {
      throw new ForbiddenError(
        "You do not have permission to reorder materials"
      );
    }

    // Update material orders in transaction
    await prisma.$transaction(
      materials.map((material) =>
        prisma.material.update({
          where: { id: material.id },
          data: { order: material.order },
        })
      )
    );

    // Get updated materials
    return this.getSectionMaterials(section_id);
  }

  /**
   * Get section materials
   */
  async getSectionMaterials(section_id: string) {
    const materials = await prisma.material.findMany({
      where: { section_id },
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
      },
    });

    return materials;
  }

  /**
   * Get material resources
   */
  async getMaterialResources(material_id: string) {
    const material = await prisma.material.findUnique({
      where: { id: material_id },
      include: {
        resources: {
          orderBy: { created_at: "asc" },
        },
      },
    });

    if (!material) {
      throw new NotFoundError("Material not found");
    }

    return material.resources;
  }

  /**
   * Add resource to material
   */
  async addResource(
    material_id: string,
    user_id: string,
    user_role: string,
    data: {
      title: string;
      description?: string;
      file_url: string;
      file_type: string;
      file_size: number;
    }
  ) {
    // Check material ownership
    const material = await prisma.material.findUnique({
      where: { id: material_id },
      include: {
        section: {
          include: {
            course: {
              include: {
                mentor: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!material) {
      throw new NotFoundError("Material not found");
    }

    // Check permission
    if (
      user_role !== USER_ROLES.ADMIN &&
      material.section.course.mentor.user_id !== user_id
    ) {
      throw new ForbiddenError("You do not have permission to add resources");
    }

    const resource = await prisma.resource.create({
      data: {
        material_id,
        ...data,
      },
    });

    return resource;
  }

  /**
   * Delete resource
   */
  async deleteResource(
    resource_id: string,
    user_id: string,
    user_role: string
  ) {
    const resource = await prisma.resource.findUnique({
      where: { id: resource_id },
      include: {
        material: {
          include: {
            section: {
              include: {
                course: {
                  include: {
                    mentor: {
                      include: {
                        user: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!resource) {
      throw new NotFoundError("Resource not found");
    }

    // Check permission
    if (
      user_role !== USER_ROLES.ADMIN &&
      resource.material.section.course.mentor.user_id !== user_id
    ) {
      throw new ForbiddenError(
        "You do not have permission to delete this resource"
      );
    }

    await prisma.resource.delete({
      where: { id: resource_id },
    });

    return { id: resource_id, deleted: true };
  }

  /**
   * Link video to material
   */
  async linkVideoToMaterial(
    material_id: string,
    video_id: string,
    user_id: string,
    user_role: string
  ) {
    const material = await prisma.material.findUnique({
      where: { id: material_id },
      include: {
        section: {
          include: {
            course: {
              include: {
                mentor: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!material) {
      throw new NotFoundError("Material not found");
    }

    // Check permission
    if (
      user_role !== USER_ROLES.ADMIN &&
      material.section.course.mentor.user_id !== user_id
    ) {
      throw new ForbiddenError("You do not have permission to link video");
    }

    // Verify video exists
    const video = await prisma.video.findUnique({
      where: { id: video_id },
    });

    if (!video) {
      throw new NotFoundError("Video not found");
    }

    // Update material with video
    const updated = await prisma.material.update({
      where: { id: material_id },
      data: {
        video_id,
        duration: video.duration || 0,
      },
      include: {
        video: true,
      },
    });

    // Update section duration
    await this.updateSectionDuration(material.section_id);

    return updated;
  }

  /**
   * Get materials by course ID
   */
  async getMaterialsByCourseId(course_id: string) {
    const sections = await prisma.section.findMany({
      where: { course_id },
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
          },
        },
      },
      orderBy: { order: "asc" },
    });

    return sections;
  }

  /**
   * Get course progress for user
   */
  async getUserCourseProgress(user_id: string, course_id: string) {
    const materials = await prisma.material.findMany({
      where: {
        section: {
          course_id,
        },
      },
      include: {
        progress: {
          where: { user_id },
        },
      },
    });

    const totalMaterials = materials.length;
    const completedMaterials = materials.filter((m: any) =>
      m.progress.some((p: any) => p.is_completed)
    ).length;

    return {
      total_materials: totalMaterials,
      completed_materials: completedMaterials,
      progress_percentage:
        totalMaterials > 0 ? (completedMaterials / totalMaterials) * 100 : 0,
    };
  }

  /**
   * Reorder materials after deletion
   */
  private async reorderMaterialsAfterDelete(
    section_id: string,
    deleted_order: number
  ) {
    await prisma.material.updateMany({
      where: {
        section_id,
        order: { gt: deleted_order },
      },
      data: {
        order: { decrement: 1 },
      },
    });
  }

  /**
   * Update section duration
   */
  private async updateSectionDuration(section_id: string) {
    const materials = await prisma.material.findMany({
      where: { section_id },
      select: { duration: true },
    });

    const total_duration = materials.reduce(
      (sum: number, material: any) => sum + material.duration,
      0
    );

    await prisma.section.update({
      where: { id: section_id },
      data: { duration: total_duration },
    });

    // Update course total duration
    await this.updateCourseDuration(section_id);

    return total_duration;
  }

  /**
   * Update course total duration
   */
  private async updateCourseDuration(section_id: string) {
    const section = await prisma.section.findUnique({
      where: { id: section_id },
      select: { course_id: true },
    });

    if (!section) return;

    const sections = await prisma.section.findMany({
      where: { course_id: section.course_id },
      select: { duration: true },
    });

    const total_duration = sections.reduce(
      (sum: number, section: any) => sum + section.duration,
      0
    );

    await prisma.course.update({
      where: { id: section.course_id },
      data: { total_duration },
    });

    return total_duration;
  }
}

const materialService = new MaterialService();
export default materialService;
