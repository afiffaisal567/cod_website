import prisma from "@/lib/prisma";
import { hashPassword } from "@/utils/crypto.util";
import { ConflictError, NotFoundError } from "@/utils/error.util";
import { USER_STATUS } from "@/lib/constants";
import type { UserRole, UserStatus, Prisma } from "@prisma/client";

/**
 * User Service
 * Handles user CRUD operations and management
 */
export class UserService {
  /**
   * Get all users with pagination and filters
   */
  async getAllUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: UserRole;
    status?: UserStatus;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = params;

    // Build where clause
    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute queries
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          profilePicture: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
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
   * Get user by ID
   */
  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        profilePicture: true,
        bio: true,
        phoneNumber: true,
        dateOfBirth: true,
        address: true,
        city: true,
        country: true,
        emailVerified: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        mentorProfile: {
          select: {
            id: true,
            expertise: true,
            experience: true,
            status: true,
            totalStudents: true,
            totalCourses: true,
            averageRating: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return user;
  }

  /**
   * Create new user (admin only)
   */
  async createUser(data: {
    email: string;
    password: string;
    name: string;
    role?: UserRole;
    status?: UserStatus;
  }) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictError("User with this email already exists");
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: data.role || "STUDENT",
        status: data.status || USER_STATUS.ACTIVE,
        emailVerified: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return user;
  }

  /**
   * Update user
   */
  async updateUser(
    userId: string,
    data: {
      name?: string;
      bio?: string;
      phoneNumber?: string;
      dateOfBirth?: Date;
      address?: string;
      city?: string;
      country?: string;
      profilePicture?: string | null;
    }
  ) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundError("User not found");
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...data,
        phoneNumber: data.phoneNumber || null,
        address: data.address || null,
        city: data.city || null,
        country: data.country || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        profilePicture: true,
        bio: true,
        phoneNumber: true,
        dateOfBirth: true,
        address: true,
        city: true,
        country: true,
        updatedAt: true,
      },
    });

    return user;
  }
  /**
   * Update user role (admin only)
   */
  async updateUserRole(userId: string, role: UserRole) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });
  }

  /**
   * Update user status (admin only)
   */
  async updateUserStatus(userId: string, status: UserStatus) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return prisma.user.update({
      where: { id: userId },
      data: { status },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
      },
    });
  }

  /**
   * Delete user (soft delete by setting status to INACTIVE)
   */
  async deleteUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Soft delete: set status to INACTIVE
    await prisma.user.update({
      where: { id: userId },
      data: { status: USER_STATUS.INACTIVE },
    });

    return { id: userId, deleted: true };
  }

  /**
   * Hard delete user (admin only, permanent)
   */
  async hardDeleteUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Permanent delete
    await prisma.user.delete({
      where: { id: userId },
    });

    return { id: userId, deleted: true, permanent: true };
  }

  /**
   * Suspend user
   */
  async suspendUser(userId: string, reason?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Update status to SUSPENDED
    await prisma.user.update({
      where: { id: userId },
      data: { status: USER_STATUS.SUSPENDED },
    });

    // TODO: Log suspension with reason
    // await prisma.activityLog.create({...})

    return { id: userId, suspended: true, reason };
  }

  /**
   * Activate user
   */
  async activateUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    await prisma.user.update({
      where: { id: userId },
      data: { status: USER_STATUS.ACTIVE },
    });

    return { id: userId, activated: true };
  }

  /**
   * Get user statistics
   */
  async getUserStatistics() {
    const [total, byRole, byStatus, newThisMonth] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({
        by: ["role"],
        _count: true,
      }),
      prisma.user.groupBy({
        by: ["status"],
        _count: true,
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    return {
      total,
      byRole: Object.fromEntries(byRole.map((r) => [r.role, r._count])),
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      newThisMonth,
    };
  }

  /**
   * Search users
   */
  async searchUsers(query: string, limit: number = 10) {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profilePicture: true,
      },
    });

    return users;
  }
}

// Export singleton instance
const userService = new UserService();
export default userService;
