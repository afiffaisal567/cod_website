// src/services/progress.service.ts
import prisma from "@/lib/prisma";
import { NotFoundError, ForbiddenError } from "@/utils/error.util";
import type { Prisma } from "@prisma/client";

/**
 * Progress Service
 * Handles learning progress tracking
 * ✅ FIXED: All field names now match Prisma schema
 */
export class ProgressService {
  /**
   * Update material progress
   */
  async updateMaterialProgress(
    userId: string,
    enrollmentId: string,
    materialId: string,
    data: {
      watchedDuration?: number;
      lastPosition?: number;
      isCompleted?: boolean;
    }
  ) {
    // Verify enrollment belongs to user
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });

    if (!enrollment || enrollment.user_id !== userId) {
      throw new ForbiddenError("Access denied to this enrollment");
    }

    // Upsert progress record - FIXED: using correct field names
    const progress = await prisma.progress.upsert({
      where: {
        enrollment_id_material_id: {
          enrollment_id: enrollmentId,
          material_id: materialId,
        },
      },
      update: {
        watched_duration: data.watchedDuration,
        last_position: data.lastPosition,
        is_completed: data.isCompleted,
        completed_at: data.isCompleted ? new Date() : undefined,
      },
      create: {
        user_id: userId,
        enrollment_id: enrollmentId,
        material_id: materialId,
        watched_duration: data.watchedDuration || 0,
        last_position: data.lastPosition || 0,
        is_completed: data.isCompleted || false,
        completed_at: data.isCompleted ? new Date() : undefined,
      },
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
    });

    // Update overall enrollment progress
    await this.updateEnrollmentProgress(enrollmentId);

    return progress;
  }

  /**
   * Get material progress
   */
  async getMaterialProgress(enrollmentId: string, materialId: string) {
    const progress = await prisma.progress.findUnique({
      where: {
        enrollment_id_material_id: {
          enrollment_id: enrollmentId,
          material_id: materialId,
        },
      },
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
    });

    return progress;
  }

  /**
   * Get enrollment progress summary
   */
  async getEnrollmentProgressSummary(enrollmentId: string) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
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
        progress_records: {
          include: {
            material: true,
          },
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundError("Enrollment not found");
    }

    // Calculate statistics
    const allMaterials = enrollment.course.sections.flatMap((s) => s.materials);
    const totalMaterials = allMaterials.length;
    const completedMaterials = enrollment.progress_records.filter(
      (p) => p.is_completed
    ).length;
    const progressPercentage =
      totalMaterials > 0 ? (completedMaterials / totalMaterials) * 100 : 0;

    // Calculate watch time
    const totalWatchTime = enrollment.progress_records.reduce(
      (sum, p) => sum + p.watched_duration,
      0
    );
    const totalCourseDuration = allMaterials.reduce(
      (sum, m) => sum + m.duration,
      0
    );

    return {
      enrollmentId: enrollment.id,
      courseId: enrollment.course_id,
      totalMaterials,
      completedMaterials,
      progressPercentage,
      totalWatchTime,
      totalCourseDuration,
      lastAccessedAt: enrollment.last_accessed_at,
    };
  }

  /**
   * Mark material as completed
   */
  async markMaterialComplete(
    userId: string,
    enrollmentId: string,
    materialId: string
  ) {
    return this.updateMaterialProgress(userId, enrollmentId, materialId, {
      isCompleted: true,
    });
  }

  /**
   * Update enrollment progress percentage
   */
  private async updateEnrollmentProgress(enrollmentId: string) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
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

    if (!enrollment) return;

    const allMaterialIds = enrollment.course.sections.flatMap((section) =>
      section.materials.map((m) => m.id)
    );

    const totalMaterials = allMaterialIds.length;
    const completedMaterials = await prisma.progress.count({
      where: {
        enrollment_id: enrollmentId,
        material_id: { in: allMaterialIds },
        is_completed: true,
      },
    });

    const progressPercentage =
      totalMaterials > 0 ? (completedMaterials / totalMaterials) * 100 : 0;

    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        progress: progressPercentage,
        status: progressPercentage >= 100 ? "COMPLETED" : "ACTIVE",
        completed_at: progressPercentage >= 100 ? new Date() : null,
      },
    });

    return progressPercentage;
  }

  /**
   * Get user course progress
   */
  async getUserCourseProgress(userId: string, courseId: string) {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        user_id_course_id: {
          user_id: userId,
          course_id: courseId,
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundError("Enrollment not found");
    }

    return this.getEnrollmentProgressSummary(enrollment.id);
  }

  /**
   * Reset material progress
   */
  async resetMaterialProgress(
    userId: string,
    enrollmentId: string,
    materialId: string
  ) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });

    if (!enrollment || enrollment.user_id !== userId) {
      throw new ForbiddenError("Access denied");
    }

    await prisma.progress.delete({
      where: {
        enrollment_id_material_id: {
          enrollment_id: enrollmentId,
          material_id: materialId,
        },
      },
    });

    await this.updateEnrollmentProgress(enrollmentId);

    return { success: true };
  }
}

const progressService = new ProgressService();
export default progressService;
