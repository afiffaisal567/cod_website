import prisma from '@/lib/prisma';
import { hashPassword, comparePassword, generateToken } from '@/utils/crypto.util';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@/lib/auth';
import emailService from './email.service';
import { AppError, UnauthorizedError, ConflictError } from '@/utils/error.util';
import { HTTP_STATUS, USER_STATUS } from '@/lib/constants';
import type {
  RegistrationData,
  LoginCredentials,
  AuthResponse,
  TokenPair,
} from '@/types/auth.types';

/**
 * Authentication Service
 * Handles user registration, login, logout, and token management
 */
export class AuthService {
  /**
   * Register new user
   */
  async register(data: RegistrationData): Promise<AuthResponse> {
    const { email, password, name, disability_type, role = 'STUDENT' } = data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
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

    // Generate email verification token
    const verificationToken = generateToken();

    // Store token in database
    await prisma.verificationToken.create({
      data: {
        user_id: user.id,
        token: verificationToken,
        type: 'EMAIL_VERIFICATION',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Send verification email
    await emailService.sendVerificationEmail(user.email, user.full_name, verificationToken);

    // Generate tokens
    const tokens = this.generateTokenPair(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name,
        disability_type: user.disability_type,
        role: user.role,
      },
      tokens,
    };
  }

  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { email, password } = credentials;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check password
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if user is active
    if (user.status !== USER_STATUS.ACTIVE) {
      throw new UnauthorizedError('Account is suspended or inactive');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { last_login: new Date() },
    });

    // Generate tokens
    const tokens = this.generateTokenPair(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name,
        disability_type: user.disability_type,
        role: user.role,
      },
      tokens,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      // Verify refresh token
      const payload = verifyRefreshToken(refreshToken);

      // Check if user still exists and is active
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user || user.status !== USER_STATUS.ACTIVE) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Generate new token pair
      return this.generateTokenPair(user.id, user.email, user.role);
    } catch (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  /**
   * Logout user (client-side token removal)
   */
  async logout(userId: string): Promise<void> {
    // Update user activity
    await prisma.user.update({
      where: { id: userId },
      data: { last_login: new Date() },
    });

    // In production, you might want to blacklist tokens in Redis
    // await redis.set(`blacklist:${token}`, '1', 'EX', 3600);
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<void> {
    const verificationToken = await prisma.verificationToken.findFirst({
      where: { 
        token,
        type: 'EMAIL_VERIFICATION',
        expires_at: { gt: new Date() },
        used_at: null,
      },
      include: { user: true },
    });

    if (!verificationToken) {
      throw new AppError('Invalid or expired verification token', HTTP_STATUS.BAD_REQUEST);
    }

    // Update user email verification status
    await prisma.user.update({
      where: { id: verificationToken.user_id },
      data: { 
        email_verified: true,
        email_verified_at: new Date(),
      },
    });

    // Mark token as used
    await prisma.verificationToken.update({
      where: { id: verificationToken.id },
      data: { used_at: new Date() },
    });
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists
      return;
    }

    // Generate reset token
    const resetToken = generateToken();

    // Store token
    await prisma.verificationToken.create({
      data: {
        user_id: user.id,
        token: resetToken,
        type: 'PASSWORD_RESET',
        expires_at: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour
      },
    });

    // Send reset email
    await emailService.sendPasswordResetEmail(user.email, user.full_name, resetToken);
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetToken = await prisma.verificationToken.findFirst({
      where: { 
        token,
        type: 'PASSWORD_RESET',
        expires_at: { gt: new Date() },
        used_at: null,
      },
      include: { user: true },
    });

    if (!resetToken) {
      throw new AppError('Invalid or expired reset token', HTTP_STATUS.BAD_REQUEST);
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: resetToken.user_id },
      data: { password: hashedPassword },
    });

    // Mark token as used
    await prisma.verificationToken.update({
      where: { id: resetToken.id },
      data: { used_at: new Date() },
    });
  }

  /**
   * Change password (for logged-in users)
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    // Verify current password
    const isPasswordValid = await comparePassword(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists
      return;
    }

    if (user.email_verified) {
      throw new AppError('Email already verified', HTTP_STATUS.BAD_REQUEST);
    }

    // Generate new verification token
    const verificationToken = generateToken();

    // Delete any existing verification tokens
    await prisma.verificationToken.deleteMany({
      where: { 
        user_id: user.id,
        type: 'EMAIL_VERIFICATION',
      },
    });

    // Store new token
    await prisma.verificationToken.create({
      data: {
        user_id: user.id,
        token: verificationToken,
        type: 'EMAIL_VERIFICATION',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    await emailService.sendVerificationEmail(user.email, user.full_name, verificationToken);
  }

  /**
   * Get current user
   */
  async getCurrentUser(userId: string) {
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
        email_verified: true,
        created_at: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    return {
      id: user.id,
      email: user.email,
      name: user.full_name,
      disability_type: user.disability_type,
      role: user.role,
      status: user.status,
      avatar_url: user.avatar_url,
      bio: user.bio,
      email_verified: user.email_verified,
      created_at: user.created_at,
    };
  }

  /**
   * Generate token pair
   */
  private generateTokenPair(userId: string, email: string, role: string): TokenPair {
    return {
      accessToken: generateAccessToken({ userId, email, role }),
      refreshToken: generateRefreshToken({ userId, email, role }),
    };
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService;