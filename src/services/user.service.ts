import prisma from "@/lib/prisma";
import { hashPassword } from "@/utils/crypto.util";
import { ConflictError, NotFoundError } from "@/utils/error.util";
import { USER_STATUS, USER_ROLES } from "@/lib/constants";

// Define types locally since Prisma types are not available
type UserRole = "ADMIN" | "MENTOR" | "STUDENT";
type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING";
type DisabilityType =
  | "VISUAL"
  | "HEARING"
  | "PHYSICAL"
  | "INTELLECTUAL"
  | "MENTAL_HEALTH"
  | "SPEECH"
  | "MULTIPLE"
  | "OTHER"
  | "NONE";

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
      sortBy = "created_at",
      sortOrder = "desc",
    } = params;

    // Build where clause
    const where: any = {};

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
          full_name: true,
          role: true,
          status: true,
          avatar_url: true,
          email_verified: true,
          created_at: true,
          updated_at: true,
          last_login: true,
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
        full_name: true,
        role: true,
        status: true,
        avatar_url: true,
        bio: true,
        phone: true,
        date_of_birth: true,
        address: true,
        city: true,
        country: true,
        disability_type: true,
        email_verified: true,
        email_verified_at: true,
        created_at: true,
        updated_at: true,
        last_login: true,
        mentor_profile: {
          select: {
            id: true,
            expertise: true,
            experience: true,
            status: true,
            total_students: true,
            total_courses: true,
            average_rating: true,
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
    disability_type?: DisabilityType | null;
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
        full_name: data.name,
        role: data.role || "STUDENT",
        status: data.status || USER_STATUS.ACTIVE,
        disability_type: data.disability_type || null,
        email_verified: false,
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        status: true,
        disability_type: true,
        created_at: true,
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
      phone?: string;
      date_of_birth?: Date;
      address?: string;
      city?: string;
      country?: string;
      avatar_url?: string | null;
      disability_type?: DisabilityType | null;
    }
  ) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundError("User not found");
    }

    // Prepare update data
    const updateData: any = {};

    if (data.name !== undefined) updateData.full_name = data.name;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.date_of_birth !== undefined)
      updateData.date_of_birth = data.date_of_birth;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.avatar_url !== undefined) updateData.avatar_url = data.avatar_url;
    if (data.disability_type !== undefined)
      updateData.disability_type = data.disability_type;

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        status: true,
        avatar_url: true,
        bio: true,
        phone: true,
        date_of_birth: true,
        address: true,
        city: true,
        country: true,
        disability_type: true,
        updated_at: true,
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
        full_name: true,
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
        full_name: true,
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
          created_at: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    return {
      total,
      byRole: Object.fromEntries(byRole.map((r: any) => [r.role, r._count])),
      byStatus: Object.fromEntries(
        byStatus.map((s: any) => [s.status, s._count])
      ),
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
          { full_name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      take: limit,
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        avatar_url: true,
      },
    });

    return users;
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { last_login: new Date() },
    });
  }

  /**
   * Verify user email
   */
  async verifyEmail(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        email_verified: true,
        email_verified_at: new Date(),
      },
    });
  }

  /**
   * Get users by disability type
   */
  async getUsersByDisabilityType(
    disabilityType: DisabilityType,
    page: number = 1,
    limit: number = 10
  ) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { disability_type: disabilityType },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          full_name: true,
          role: true,
          status: true,
          avatar_url: true,
          disability_type: true,
          created_at: true,
        },
        orderBy: { created_at: "desc" },
      }),
      prisma.user.count({
        where: { disability_type: disabilityType },
      }),
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
   * Get disability type enum values
   */
  getDisabilityTypes(): DisabilityType[] {
    return [
      "VISUAL",
      "HEARING",
      "PHYSICAL",
      "INTELLECTUAL",
      "MENTAL_HEALTH",
      "SPEECH",
      "MULTIPLE",
      "OTHER",
      "NONE",
    ];
  }

  /**
   * Validate disability type
   */
  isValidDisabilityType(type: string): type is DisabilityType {
    return this.getDisabilityTypes().includes(type as DisabilityType);
  }

  /**
   * Convert string to DisabilityType enum
   */
  parseDisabilityType(type: string): DisabilityType | null {
    if (this.isValidDisabilityType(type)) {
      return type as DisabilityType;
    }
    return null;
  }
}

// Export singleton instance
const userService = new UserService();
export default userService;
