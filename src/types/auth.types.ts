export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Token Pair
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Login Credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Registration Data
 */
export interface RegistrationData {
  email: string;
  password: string;
  name: string;
  disability_type?: 'BUTA_WARNA' | 'DISLEKSIA' | 'KOGNITIF' | 'LOW_VISION' | 'MENTOR' | 'MOTORIK' | 'TUNARUNGU';
  role?: 'STUDENT' | 'MENTOR';
}

/**
 * Auth Response
 */
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    disability_type?: string | null;
    role: string;
  };
  tokens: TokenPair;
}

/**
 * Password Reset Request
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Password Reset
 */
export interface PasswordReset {
  token: string;
  newPassword: string;
}

/**
 * Change Password
 */
export interface ChangePassword {
  currentPassword: string;
  newPassword: string;
}

/**
 * Email Verification
 */
export interface EmailVerification {
  token: string;
}

/**
 * Session Data
 */
export interface SessionData {
  userId: string;
  email: string;
  role: string;
  lastActivity: Date;
}

/**
 * User Profile
 */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  disability_type?: string | null;
  role: string;
  status: string;
  avatar_url?: string;
  bio?: string;
  email_verified: boolean;
  created_at: Date;
}