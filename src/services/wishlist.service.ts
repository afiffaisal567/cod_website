import prisma from "@/lib/prisma";
import { NotFoundError, ConflictError } from "@/utils/error.util";
import { HTTP_STATUS } from "@/lib/constants";

/**
 * Wishlist Service
 * Handles user wishlist operations
 */
export class WishlistService {
  /**
   * Add course to wishlist
   */
  async addToWishlist(userId: string, courseId: string) {
    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundError("Course not found");
    }

    // Check if already in wishlist
    const existing = await prisma.wishlist.findUnique({
      where: {
        user_id_course_id: {
          user_id: userId,
          course_id: courseId,
        },
      },
    });

    if (existing) {
      throw new ConflictError("Course already in wishlist");
    }

    // Add to wishlist
    const wishlistItem = await prisma.wishlist.create({
      data: {
        user_id: userId,
        course_id: courseId,
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            thumbnail: true,
            price: true,
            discount_price: true,
            is_free: true,
            average_rating: true,
            total_students: true,
          },
        },
      },
    });

    return wishlistItem;
  }

  /**
   * Remove course from wishlist
   */
  async removeFromWishlist(userId: string, courseId: string) {
    const wishlistItem = await prisma.wishlist.findUnique({
      where: {
        user_id_course_id: {
          user_id: userId,
          course_id: courseId,
        },
      },
    });

    if (!wishlistItem) {
      throw new NotFoundError("Course not found in wishlist");
    }

    await prisma.wishlist.delete({
      where: {
        user_id_course_id: {
          user_id: userId,
          course_id: courseId,
        },
      },
    });

    return { success: true };
  }

  /**
   * Get user wishlist
   */
  async getUserWishlist(
    userId: string,
    options: {
      page?: number;
      limit?: number;
    } = {}
  ) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [wishlistItems, total] = await Promise.all([
      prisma.wishlist.findMany({
        where: { user_id: userId },
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
              price: true,
              discount_price: true,
              is_free: true,
              average_rating: true,
              total_students: true,
              total_duration: true,
              level: true,
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
        },
      }),
      prisma.wishlist.count({
        where: { user_id: userId },
      }),
    ]);

    return {
      data: wishlistItems,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Check if course is in wishlist
   */
  async isInWishlist(userId: string, courseId: string): Promise<boolean> {
    const wishlistItem = await prisma.wishlist.findUnique({
      where: {
        user_id_course_id: {
          user_id: userId,
          course_id: courseId,
        },
      },
    });

    return !!wishlistItem;
  }

  /**
   * Get wishlist count
   */
  async getWishlistCount(userId: string): Promise<number> {
    return prisma.wishlist.count({
      where: { user_id: userId },
    });
  }

  /**
   * Clear user wishlist
   */
  async clearWishlist(userId: string): Promise<{ success: boolean }> {
    await prisma.wishlist.deleteMany({
      where: { user_id: userId },
    });

    return { success: true };
  }
}

const wishlistService = new WishlistService();
export default wishlistService;
