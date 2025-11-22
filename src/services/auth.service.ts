// services/auth.service.ts
import prisma from "@/lib/prisma";
import {
  hashPassword,
  comparePassword,
  generateToken,
} from "@/utils/crypto.util";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "@/lib/auth";
import emailService, { EmailResult } from "./email.service";
import {
  AppError,
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/utils/error.util";
import { HTTP_STATUS, USER_STATUS } from "@/lib/constants";

// Types
interface RegistrationData {
  email: string;
  password: string;
  name: string;
  disability_type?: string;
  role?: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    disability_type?: string;
    role: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Authentication Service
 * Menangani registrasi, login, logout, dan manajemen token
 */
export class AuthService {
  /**
   * Register new user
   */
  async register(data: RegistrationData): Promise<AuthResponse> {
    try {
      console.log("👤 Starting user registration for:", data.email);

      const { email, password, name, disability_type, role = "STUDENT" } = data;

      // Validate input
      if (!email || !password || !name) {
        throw new ValidationError("Email, password, and name are required");
      }

      if (password.length < 8) {
        throw new ValidationError(
          "Password must be at least 8 characters long"
        );
      }

      // Check if user already exists
      console.log("🔍 Checking if user exists:", email);
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        console.log("❌ User already exists:", email);
        throw new ConflictError("User with this email already exists");
      }

      // Hash password
      console.log("🔐 Hashing password...");
      const hashedPassword = await hashPassword(password);

      // Create user
      console.log("📝 Creating user in database...");
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          full_name: name,
          disability_type,
          role,
          status: USER_STATUS.ACTIVE,
          email_verified: false,
        },
        select: {
          id: true,
          email: true,
          full_name: true,
          disability_type: true,
          role: true,
        },
      });

      console.log("✅ User created successfully:", user.id);

      // Generate email verification token
      console.log("🔑 Generating verification token...");
      const verificationToken = generateToken();

      // Store token in database
      console.log("💾 Storing verification token...");
      await prisma.verificationToken.create({
        data: {
          user_id: user.id,
          token: verificationToken,
          type: "EMAIL_VERIFICATION",
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      // Send verification email (async - don't block registration)
      console.log("📧 Sending verification email...");
      this.sendVerificationEmailAsync(
        user.email,
        user.full_name,
        verificationToken
      );

      // Generate tokens
      console.log("🎫 Generating JWT tokens...");
      const tokens = this.generateTokenPair(user.id, user.email, user.role);

      console.log("✅ Registration completed successfully for:", user.email);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.full_name,
          disability_type: user.disability_type || undefined,
          role: user.role,
        },
        tokens,
      };
    } catch (error) {
      console.error("❌ Registration failed:", error);
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      console.log("🔐 Attempting login for:", credentials.email);

      const { email, password } = credentials;

      // Validate input
      if (!email || !password) {
        throw new ValidationError("Email and password are required");
      }

      // Find user
      console.log("🔍 Finding user:", email);
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        console.log("❌ User not found:", email);
        throw new UnauthorizedError("Invalid email or password");
      }

      // Check password
      console.log("🔑 Verifying password...");
      const isPasswordValid = await comparePassword(password, user.password);

      if (!isPasswordValid) {
        console.log("❌ Invalid password for user:", email);
        throw new UnauthorizedError("Invalid email or password");
      }

      // Check if user is active
      if (user.status !== USER_STATUS.ACTIVE) {
        console.log("❌ User account not active:", user.status);
        throw new UnauthorizedError("Account is suspended or inactive");
      }

      // Check if email is verified
      if (!user.email_verified) {
        console.log("⚠️ Email not verified for user:", email);
        // Bisa di-comment jika ingin mengizinkan login tanpa verifikasi
        // throw new UnauthorizedError('Please verify your email first');
      }

      // Update last login
      console.log("📝 Updating last login...");
      await prisma.user.update({
        where: { id: user.id },
        data: { last_login: new Date() },
      });

      // Generate tokens
      console.log("🎫 Generating JWT tokens...");
      const tokens = this.generateTokenPair(user.id, user.email, user.role);

      console.log("✅ Login successful for:", email);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.full_name,
          disability_type: user.disability_type || undefined,
          role: user.role,
        },
        tokens,
      };
    } catch (error) {
      console.error("❌ Login failed:", error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      console.log("🔄 Refreshing token...");

      if (!refreshToken) {
        throw new ValidationError("Refresh token is required");
      }

      // Verify refresh token
      console.log("🔍 Verifying refresh token...");
      const payload = verifyRefreshToken(refreshToken);

      // Check if user still exists and is active
      console.log("👤 Checking user status:", payload.userId);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user || user.status !== USER_STATUS.ACTIVE) {
        console.log("❌ User not found or inactive:", payload.userId);
        throw new UnauthorizedError("Invalid refresh token");
      }

      // Generate new token pair
      console.log("🎫 Generating new token pair...");
      const tokens = this.generateTokenPair(user.id, user.email, user.role);

      console.log("✅ Token refresh successful for:", user.email);

      return tokens;
    } catch (error) {
      console.error("❌ Token refresh failed:", error);
      throw new UnauthorizedError("Invalid refresh token");
    }
  }

  /**
   * Logout user
   */
  async logout(userId: string): Promise<void> {
    try {
      console.log("🚪 Logging out user:", userId);

      // Update user activity (optional)
      await prisma.user.update({
        where: { id: userId },
        data: { last_login: new Date() },
      });

      console.log("✅ Logout successful for user:", userId);
    } catch (error) {
      console.error("❌ Logout failed:", error);
      throw new AppError("Logout failed", HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<void> {
    try {
      console.log("🔐 Verifying email with token:", token);

      if (!token) {
        throw new ValidationError("Verification token is required");
      }

      // Find verification token
      console.log("🔍 Searching for verification token...");
      const verificationToken = await prisma.verificationToken.findFirst({
        where: {
          token,
          type: "EMAIL_VERIFICATION",
          expires_at: { gt: new Date() },
          used_at: null,
        },
        include: { user: true },
      });

      if (!verificationToken) {
        console.log("❌ Invalid or expired verification token");
        throw new AppError(
          "Invalid or expired verification token",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      // Update user email verification status
      console.log("✅ Valid token found, updating user...");
      await prisma.user.update({
        where: { id: verificationToken.user_id },
        data: {
          email_verified: true,
          email_verified_at: new Date(),
        },
      });

      // Mark token as used
      console.log("🏷️ Marking token as used...");
      await prisma.verificationToken.update({
        where: { id: verificationToken.id },
        data: { used_at: new Date() },
      });

      // Send welcome email
      console.log("📧 Sending welcome email...");
      this.sendWelcomeEmailAsync(
        verificationToken.user.email,
        verificationToken.user.full_name
      );

      console.log(
        "✅ Email verification completed for:",
        verificationToken.user.email
      );
    } catch (error) {
      console.error("❌ Email verification failed:", error);
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      console.log("🔑 Requesting password reset for:", email);

      if (!email) {
        throw new ValidationError("Email is required");
      }

      // Find user
      console.log("🔍 Finding user...");
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Don't reveal if user exists (security)
        console.log("⚠️ User not found (not revealing for security)");
        return;
      }

      // Generate reset token
      console.log("🔑 Generating reset token...");
      const resetToken = generateToken();

      // Delete any existing unused tokens
      console.log("🧹 Cleaning up old tokens...");
      await prisma.verificationToken.deleteMany({
        where: {
          user_id: user.id,
          type: "PASSWORD_RESET",
          used_at: null,
        },
      });

      // Store new token
      console.log("💾 Storing new reset token...");
      await prisma.verificationToken.create({
        data: {
          user_id: user.id,
          token: resetToken,
          type: "PASSWORD_RESET",
          expires_at: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour
        },
      });

      // Tunggu sebentar untuk memastikan email service siap
      console.log("⏳ Waiting for email service to be ready...");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Send reset email
      console.log("📧 Sending password reset email...");
      const emailResult: EmailResult =
        await emailService.sendPasswordResetEmail(
          user.email,
          user.full_name,
          resetToken
        );

      if (!emailResult.success) {
        console.error(
          "❌ Failed to send password reset email:",
          emailResult.error || emailResult.message
        );
        throw new AppError(
          emailResult.error || "Failed to send reset email",
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }

      console.log("✅ Password reset request completed for:", email);
    } catch (error) {
      console.error("❌ Password reset request failed:", error);
      throw error;
    }
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      console.log("🔑 Resetting password with token...");

      if (!token || !newPassword) {
        throw new ValidationError("Token and new password are required");
      }

      if (newPassword.length < 8) {
        throw new ValidationError(
          "Password must be at least 8 characters long"
        );
      }

      // Find reset token
      console.log("🔍 Searching for reset token...");
      const resetToken = await prisma.verificationToken.findFirst({
        where: {
          token,
          type: "PASSWORD_RESET",
          expires_at: { gt: new Date() },
          used_at: null,
        },
        include: { user: true },
      });

      if (!resetToken) {
        console.log("❌ Invalid or expired reset token");
        throw new AppError(
          "Invalid or expired reset token",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      // Hash new password
      console.log("🔐 Hashing new password...");
      const hashedPassword = await hashPassword(newPassword);

      // Update password
      console.log("💾 Updating user password...");
      await prisma.user.update({
        where: { id: resetToken.user_id },
        data: { password: hashedPassword },
      });

      // Mark token as used
      console.log("🏷️ Marking token as used...");
      await prisma.verificationToken.update({
        where: { id: resetToken.id },
        data: { used_at: new Date() },
      });

      console.log("✅ Password reset successful for:", resetToken.user.email);
    } catch (error) {
      console.error("❌ Password reset failed:", error);
      throw error;
    }
  }

  /**
   * Change password (for logged-in users)
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      console.log("🔑 Changing password for user:", userId);

      if (!currentPassword || !newPassword) {
        throw new ValidationError(
          "Current password and new password are required"
        );
      }

      if (newPassword.length < 8) {
        throw new ValidationError(
          "New password must be at least 8 characters long"
        );
      }

      if (currentPassword === newPassword) {
        throw new ValidationError(
          "New password must be different from current password"
        );
      }

      // Find user
      console.log("🔍 Finding user...");
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        console.log("❌ User not found:", userId);
        throw new NotFoundError("User not found");
      }

      // Verify current password
      console.log("🔑 Verifying current password...");
      const isPasswordValid = await comparePassword(
        currentPassword,
        user.password
      );

      if (!isPasswordValid) {
        console.log("❌ Current password is incorrect");
        throw new UnauthorizedError("Current password is incorrect");
      }

      // Hash new password
      console.log("🔐 Hashing new password...");
      const hashedPassword = await hashPassword(newPassword);

      // Update password
      console.log("💾 Updating password in database...");
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      console.log("✅ Password changed successfully for user:", userId);
    } catch (error) {
      console.error("❌ Password change failed:", error);
      throw error;
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<void> {
    try {
      console.log("📧 Resending verification email to:", email);

      if (!email) {
        throw new ValidationError("Email is required");
      }

      // Find user
      console.log("🔍 Finding user...");
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Don't reveal if user exists
        console.log("⚠️ User not found (not revealing for security)");
        return;
      }

      if (user.email_verified) {
        console.log("⚠️ Email already verified for:", email);
        throw new AppError("Email already verified", HTTP_STATUS.BAD_REQUEST);
      }

      // Generate new verification token
      console.log("🔑 Generating new verification token...");
      const verificationToken = generateToken();

      // Delete any existing unused verification tokens
      console.log("🧹 Cleaning up old verification tokens...");
      await prisma.verificationToken.deleteMany({
        where: {
          user_id: user.id,
          type: "EMAIL_VERIFICATION",
          used_at: null,
        },
      });

      // Store new token
      console.log("💾 Storing new verification token...");
      await prisma.verificationToken.create({
        data: {
          user_id: user.id,
          token: verificationToken,
          type: "EMAIL_VERIFICATION",
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      // Tunggu sebentar untuk memastikan email service siap
      console.log("⏳ Waiting for email service to be ready...");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Send verification email
      console.log("📧 Sending verification email...");
      const emailResult: EmailResult = await emailService.sendVerificationEmail(
        user.email,
        user.full_name,
        verificationToken
      );

      if (!emailResult.success) {
        console.error(
          "❌ Failed to send verification email:",
          emailResult.error || emailResult.message
        );
        throw new AppError(
          emailResult.error || "Failed to send verification email",
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }

      console.log("✅ Verification email resent successfully to:", email);
    } catch (error) {
      console.error("❌ Resend verification email failed:", error);
      throw error;
    }
  }

  /**
   * Get current user data
   */
  async getCurrentUser(userId: string): Promise<any> {
    try {
      console.log("👤 Getting current user data for:", userId);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          full_name: true,
          disability_type: true,
          role: true,
          status: true,
          avatar_url: true,
          bio: true,
          phone: true,
          email_verified: true,
          created_at: true,
          last_login: true,
        },
      });

      if (!user) {
        console.log("❌ User not found:", userId);
        throw new NotFoundError("User not found");
      }

      console.log("✅ User data retrieved successfully for:", userId);

      return {
        id: user.id,
        email: user.email,
        name: user.full_name,
        disability_type: user.disability_type,
        role: user.role,
        status: user.status,
        avatar_url: user.avatar_url,
        bio: user.bio,
        phone: user.phone,
        email_verified: user.email_verified,
        created_at: user.created_at,
        last_login: user.last_login,
      };
    } catch (error) {
      console.error("❌ Get current user failed:", error);
      throw error;
    }
  }

  /**
   * Generate token pair (access + refresh)
   */
  private generateTokenPair(
    userId: string,
    email: string,
    role: string
  ): TokenPair {
    return {
      accessToken: generateAccessToken({ userId, email, role }),
      refreshToken: generateRefreshToken({ userId, email, role }),
    };
  }

  /**
   * Send verification email async (non-blocking)
   */
  private async sendVerificationEmailAsync(
    to: string,
    userName: string,
    token: string
  ): Promise<void> {
    try {
      await emailService.sendVerificationEmail(to, userName, token);
    } catch (error) {
      console.error("❌ Async verification email failed:", error);
      // Don't throw error, just log it
    }
  }

  /**
   * Send welcome email async (non-blocking)
   */
  private async sendWelcomeEmailAsync(
    to: string,
    userName: string
  ): Promise<void> {
    try {
      await emailService.sendWelcomeEmail(to, userName);
    } catch (error) {
      console.error("❌ Async welcome email failed:", error);
      // Don't throw error, just log it
    }
  }

  /**
   * Get service status (for debugging)
   */
  getServiceStatus(): any {
    return {
      emailService: emailService.getStatus(),
      database: "Connected",
      timestamp: new Date().toISOString(),
    };
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService;
