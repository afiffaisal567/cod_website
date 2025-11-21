import type { BaseEntity } from './common.types';

/**
 * Certificate Types
 */

/**
 * Certificate Status
 */
export type CertificateStatus = 'PENDING' | 'ISSUED' | 'REVOKED';

/**
 * Certificate
 */
export interface Certificate extends BaseEntity {
  userId: string;
  courseId: string;
  certificateNumber: string;
  status: CertificateStatus;
  issuedAt?: Date;
  revokedAt?: Date;
  revokeReason?: string;
  pdfUrl?: string;
  metadata?: CertificateMetadata;
}

/**
 * Certificate Metadata
 */
export interface CertificateMetadata {
  courseName: string;
  studentName: string;
  mentorName: string;
  completedAt?: Date;
  grade?: string;
  duration?: number;
}

/**
 * Certificate Detail
 */
export interface CertificateDetail extends Certificate {
  user: {
    id: string;
    name: string;
    email: string;
  };
  course: {
    id: string;
    title: string;
    mentor: {
      name: string;
    };
  };
}

/**
 * Certificate Verification
 */
export interface CertificateVerification {
  certificateNumber: string;
  isValid: boolean;
  student?: string;
  course?: string;
  issuedAt?: Date;
  status?: CertificateStatus;
}

/**
 * Generate Certificate Request
 */
export interface GenerateCertificateRequest {
  enrollmentId: string;
}
