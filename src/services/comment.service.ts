import prisma from "@/lib/prisma";
import { NotFoundError, ForbiddenError } from "@/utils/error.util";
import { HTTP_STATUS, USER_ROLES } from "@/lib/constants";
import type { Prisma } from "@prisma/client";

/**
 * Comment Creation Data
 */
interface CreateCommentData {
  materialId: string;
  content: string;
  parentId?: string;
}

/**
 * Comment Update Data
 */
interface UpdateCommentData {
  content: string;
}

/**
 * Comment Service
 * Handles comment and discussion operations
 */
export class CommentService {
  /**
   * Create new comment
   */
  async createComment(userId: string, data: CreateCommentData) {
    const { materialId, content, parentId } = data;

    // Check if material exists
    const material = await prisma.material.findUnique({
      where: { id: materialId },
      include: {
        section: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!material) {
      throw new NotFoundError("Material not found");
    }

    // Check if user is enrolled (unless it's a free preview)
    if (!material.is_free) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          user_id_course_id: {
            user_id: userId,
            course_id: material.section.course.id,
          },
        },
      });

      if (!enrollment) {
        throw new ForbiddenError("You must be enrolled to comment");
      }
    }

    // If replying, check parent comment exists
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
      });

      if (!parentComment) {
        throw new NotFoundError("Parent comment not found");
      }

      if (parentComment.material_id !== materialId) {
        throw new ForbiddenError(
          "Parent comment belongs to different material"
        );
      }
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        user_id: userId,
        material_id: materialId,
        content,
        parent_id: parentId,
      },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            avatar_url: true,
            role: true,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    return comment;
  }

  /**
   * Get comments for material
   */
  async getMaterialComments(
    materialId: string,
    options: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    } = {}
  ) {
    const {
      page = 1,
      limit = 20,
      sortBy = "created_at",
      sortOrder = "desc",
    } = options;

    const skip = (page - 1) * limit;

    // Only get top-level comments (no parent)
    const where: Prisma.CommentWhereInput = {
      material_id: materialId,
      parent_id: null,
    };

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              avatar_url: true,
              role: true,
            },
          },
          replies: {
            take: 3, // Show first 3 replies
            orderBy: { created_at: "asc" },
            include: {
              user: {
                select: {
                  id: true,
                  full_name: true,
                  avatar_url: true,
                  role: true,
                },
              },
            },
          },
          _count: {
            select: {
              replies: true,
            },
          },
        },
      }),
      prisma.comment.count({ where }),
    ]);

    return {
      data: comments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get comment by ID
   */
  async getCommentById(commentId: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            avatar_url: true,
            role: true,
          },
        },
        material: {
          select: {
            id: true,
            title: true,
          },
        },
        parent: {
          select: {
            id: true,
            content: true,
            user: {
              select: {
                full_name: true,
              },
            },
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    if (!comment) {
      throw new NotFoundError("Comment not found");
    }

    return comment;
  }

  /**
   * Get replies for comment
   */
  async getCommentReplies(
    commentId: string,
    options: {
      page?: number;
      limit?: number;
    } = {}
  ) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [replies, total] = await Promise.all([
      prisma.comment.findMany({
        where: { parent_id: commentId },
        skip,
        take: limit,
        orderBy: { created_at: "asc" },
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              avatar_url: true,
              role: true,
            },
          },
        },
      }),
      prisma.comment.count({ where: { parent_id: commentId } }),
    ]);

    return {
      data: replies,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update comment
   */
  async updateComment(
    commentId: string,
    userId: string,
    userRole: string,
    data: UpdateCommentData
  ) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundError("Comment not found");
    }

    // Check permission (owner or admin)
    if (comment.user_id !== userId && userRole !== USER_ROLES.ADMIN) {
      throw new ForbiddenError("You can only edit your own comments");
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content: data.content,
        is_edited: true,
      },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            avatar_url: true,
            role: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Delete comment
   */
  async deleteComment(commentId: string, userId: string, userRole: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        replies: true,
      },
    });

    if (!comment) {
      throw new NotFoundError("Comment not found");
    }

    // Check permission (owner or admin)
    if (comment.user_id !== userId && userRole !== USER_ROLES.ADMIN) {
      throw new ForbiddenError("You can only delete your own comments");
    }

    // If has replies, just hide content instead of deleting
    if (comment.replies.length > 0) {
      await prisma.comment.update({
        where: { id: commentId },
        data: {
          content: "[Comment deleted by user]",
          is_edited: true,
        },
      });
    } else {
      // No replies, safe to delete
      await prisma.comment.delete({
        where: { id: commentId },
      });
    }

    return { id: commentId, deleted: true };
  }

  /**
   * Report comment
   */
  async reportComment(commentId: string, userId: string, reason: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundError("Comment not found");
    }

    // In production, create a report record
    // For now, just log it
    console.log("Comment reported:", {
      commentId,
      reportedBy: userId,
      reason,
    });

    return {
      commentId,
      reported: true,
      message: "Comment has been reported and will be reviewed by moderators",
    };
  }

  /**
   * Get comment statistics for a material
   */
  async getMaterialCommentStats(materialId: string) {
    const [totalComments, totalReplies] = await Promise.all([
      prisma.comment.count({
        where: {
          material_id: materialId,
          parent_id: null,
        },
      }),
      prisma.comment.count({
        where: {
          material_id: materialId,
          parent_id: { not: null },
        },
      }),
    ]);

    return {
      totalComments,
      totalReplies,
      totalDiscussions: totalComments + totalReplies,
    };
  }

  /**
   * Get user's comments
   */
  async getUserComments(
    userId: string,
    options: {
      page?: number;
      limit?: number;
    } = {}
  ) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: { user_id: userId },
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          material: {
            select: {
              id: true,
              title: true,
              section: {
                select: {
                  course: {
                    select: {
                      id: true,
                      title: true,
                    },
                  },
                },
              },
            },
          },
          parent: {
            select: {
              id: true,
              content: true,
            },
          },
          _count: {
            select: {
              replies: true,
            },
          },
        },
      }),
      prisma.comment.count({ where: { user_id: userId } }),
    ]);

    return {
      data: comments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Search comments by content
   */
  async searchComments(
    query: string,
    materialId?: string,
    options: {
      page?: number;
      limit?: number;
    } = {}
  ) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.CommentWhereInput = {
      content: {
        contains: query,
        mode: "insensitive",
      },
      ...(materialId && { material_id: materialId }),
    };

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
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
          material: {
            select: {
              id: true,
              title: true,
              section: {
                select: {
                  course: {
                    select: {
                      id: true,
                      title: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.comment.count({ where }),
    ]);

    return {
      data: comments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

const commentService = new CommentService();
export default commentService;
