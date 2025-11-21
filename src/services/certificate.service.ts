import { sql } from '@vercel/postgres';
import crypto from 'crypto';
import { logError, logInfo } from '@/utils/logger.util';

export interface Certificate {
  id: string;
  user_id: string;
  course_id: string;
  certificate_number: string;
  certificate_code: string;
  issued_at: Date;
  completed_at: Date;
  pdf_url?: string;
  is_valid: boolean;
  created_at: Date;
}

export interface CertificateData {
  user_name: string;
  user_email: string;
  course_title: string;
  course_description: string;
  instructor_name: string;
  completion_date: Date;
  duration_hours: number;
  certificate_number: string;
  certificate_code: string;
}

class CertificateService {
  // Generate unique certificate number
  private generateCertificateNumber(): string {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `CERT-${year}${month}-${random}`;
  }

  // Generate verification code
  private generateVerificationCode(
    userId: string,
    courseId: string,
    certificateNumber: string
  ): string {
    const secret = process.env.CERTIFICATE_SECRET || 'default-secret-key';
    const data = `${userId}-${courseId}-${certificateNumber}`;
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex')
      .substring(0, 16)
      .toUpperCase();
  }

  // Check if certificate already exists
  async getCertificateByEnrollment(userId: string, courseId: string): Promise<Certificate | null> {
    try {
      const result = await sql`
        SELECT * FROM certificates
        WHERE user_id = ${userId}
        AND course_id = ${courseId}
        AND is_valid = true
      `;

      return (result.rows[0] as Certificate) || null;
    } catch (error) {
      console.error('Get certificate by enrollment error:', error);
      return null;
    }
  }

  // Generate new certificate
  async generateCertificate(
    userId: string,
    courseId: string,
    completedAt: Date
  ): Promise<Certificate | null> {
    try {
      // Check if certificate already exists
      const existing = await this.getCertificateByEnrollment(userId, courseId);
      if (existing) {
        return existing;
      }

      // Generate certificate identifiers
      const certificateNumber = this.generateCertificateNumber();
      const certificateCode = this.generateVerificationCode(userId, courseId, certificateNumber);

      // Create certificate record
      const result = await sql`
        INSERT INTO certificates (
          user_id, course_id, certificate_number, 
          certificate_code, issued_at, completed_at, 
          is_valid
        )
        VALUES (
          ${userId}, ${courseId}, ${certificateNumber},
          ${certificateCode}, NOW(), ${completedAt.toISOString()},
          true
        )
        RETURNING *
      `;

      const certificate = result.rows[0] as Certificate;

      // Generate PDF (async)
      this.generateCertificatePDF(certificate.id).catch((error) => {
        console.error('PDF generation error:', error);
      });

      // Update enrollment with certificate
      await sql`
        UPDATE enrollments
        SET certificate_id = ${certificate.id}, updated_at = NOW()
        WHERE user_id = ${userId} AND course_id = ${courseId}
      `;

      // Create notification
      await sql`
        INSERT INTO notifications (
          user_id, title, message, type, 
          reference_id, reference_type
        )
        VALUES (
          ${userId},
          'Certificate Ready',
          'Congratulations! Your course completion certificate is now available.',
          'certificate_issued',
          ${certificate.id},
          'certificate'
        )
      `;

      return certificate;
    } catch (error) {
      console.error('Generate certificate error:', error);
      return null;
    }
  }

  // Generate certificate PDF
  private async generateCertificatePDF(certificateId: string): Promise<string | null> {
    try {
      // Get certificate data
      const data = await this.getCertificateData(certificateId);
      if (!data) {
        throw new Error('Certificate data not found');
      }

      // Generate PDF using a library like PDFKit or Puppeteer
      const pdfContent = await this.createPDFContent(data);

      // Upload to storage (S3, Cloudinary, etc.)
      const pdfUrl = await this.uploadPDF(certificateId, pdfContent);

      // Update certificate with PDF URL
      await sql`
        UPDATE certificates
        SET pdf_url = ${pdfUrl}, updated_at = NOW()
        WHERE id = ${certificateId}
      `;

      return pdfUrl;
    } catch (error) {
      console.error('Generate PDF error:', error);
      return null;
    }
  }

  // Create PDF content (placeholder - implement with actual PDF library)
  private async createPDFContent(data: CertificateData): Promise<Buffer> {
    // This is a placeholder. In production, use:
    // - PDFKit: for programmatic PDF generation
    // - Puppeteer: for HTML to PDF conversion
    // - pdf-lib: for PDF manipulation

    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: 'Georgia', serif;
              text-align: center;
              padding: 50px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .certificate {
              background: white;
              padding: 60px;
              border: 10px solid #gold;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 { font-size: 48px; color: #333; margin-bottom: 20px; }
            h2 { font-size: 32px; color: #666; margin: 30px 0; }
            .name { font-size: 40px; color: #667eea; font-weight: bold; }
            .course { font-size: 28px; color: #333; margin: 20px 0; }
            .details { font-size: 16px; color: #666; margin-top: 40px; }
            .code { font-size: 14px; color: #999; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="certificate">
            <h1>Certificate of Completion</h1>
            <p>This certifies that</p>
            <div class="name">${data.user_name}</div>
            <p>has successfully completed the course</p>
            <div class="course">${data.course_title}</div>
            <p>on ${data.completion_date.toLocaleDateString()}</p>
            <div class="details">
              <p>Course Duration: ${data.duration_hours} hours</p>
              <p>Instructor: ${data.instructor_name}</p>
            </div>
            <div class="code">
              <p>Certificate Number: ${data.certificate_number}</p>
              <p>Verification Code: ${data.certificate_code}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Convert HTML to PDF buffer (placeholder)
    return Buffer.from(htmlTemplate);
  }

  // Upload PDF to storage
  private async uploadPDF(certificateId: string, _content: Buffer): Promise<string> {
    // Placeholder - implement actual upload to S3, Cloudinary, etc.
    // For now, return a mock URL
    return `https://storage.example.com/certificates/${certificateId}.pdf`;
  }

  // Get certificate data for PDF generation
  async getCertificateData(certificateId: string): Promise<CertificateData | null> {
    try {
      const result = await sql`
        SELECT 
          c.*,
          u.full_name as user_name,
          u.email as user_email,
          co.title as course_title,
          co.description as course_description,
          co.duration_hours,
          i.full_name as instructor_name
        FROM certificates c
        JOIN users u ON c.user_id = u.id
        JOIN courses co ON c.course_id = co.id
        JOIN users i ON co.instructor_id = i.id
        WHERE c.id = ${certificateId}
      `;

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        user_name: String(row.user_name),
        user_email: String(row.user_email),
        course_title: String(row.course_title),
        course_description: String(row.course_description),
        instructor_name: String(row.instructor_name),
        completion_date: new Date(row.completed_at as string),
        duration_hours: Number(row.duration_hours),
        certificate_number: String(row.certificate_number),
        certificate_code: String(row.certificate_code),
      };
    } catch (error) {
      console.error('Get certificate data error:', error);
      return null;
    }
  }

  // Get certificate by ID
  async getCertificateById(certificateId: string): Promise<Certificate | null> {
    try {
      const result = await sql`
        SELECT 
          c.*,
          u.full_name as user_name,
          u.email as user_email,
          co.title as course_title,
          co.thumbnail_url as course_thumbnail,
          i.full_name as instructor_name
        FROM certificates c
        JOIN users u ON c.user_id = u.id
        JOIN courses co ON c.course_id = co.id
        JOIN users i ON co.instructor_id = i.id
        WHERE c.id = ${certificateId}
      `;

      return (result.rows[0] as Certificate) || null;
    } catch (error) {
      console.error('Get certificate by ID error:', error);
      return null;
    }
  }

  // Verify certificate
  async verifyCertificate(
    certificateNumber: string,
    verificationCode: string
  ): Promise<{
    valid: boolean;
    certificate?: Certificate;
    message: string;
  }> {
    try {
      const result = await sql`
        SELECT 
          c.*,
          u.full_name as user_name,
          co.title as course_title,
          co.description as course_description
        FROM certificates c
        JOIN users u ON c.user_id = u.id
        JOIN courses co ON c.course_id = co.id
        WHERE c.certificate_number = ${certificateNumber}
        AND c.is_valid = true
      `;

      if (result.rows.length === 0) {
        return {
          valid: false,
          message: 'Certificate not found',
        };
      }

      const certificate = result.rows[0] as Certificate;

      // Verify code
      if (certificate.certificate_code !== verificationCode.toUpperCase()) {
        return {
          valid: false,
          message: 'Invalid verification code',
        };
      }

      return {
        valid: true,
        certificate,
        message: 'Certificate is valid',
      };
    } catch (error) {
      console.error('Verify certificate error:', error);
      return {
        valid: false,
        message: 'Verification failed',
      };
    }
  }

  // Get user certificates
  async getUserCertificates(
    userId: string,
    filters?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<{ certificates: Certificate[]; total: number }> {
    try {
      const limit = filters?.limit || 10;
      const offset = filters?.offset || 0;

      const result = await sql`
        SELECT 
          c.*,
          co.title as course_title,
          co.thumbnail_url as course_thumbnail,
          i.full_name as instructor_name
        FROM certificates c
        JOIN courses co ON c.course_id = co.id
        JOIN users i ON co.instructor_id = i.id
        WHERE c.user_id = ${userId}
        AND c.is_valid = true
        ORDER BY c.issued_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const countResult = await sql`
        SELECT COUNT(*) as total
        FROM certificates
        WHERE user_id = ${userId}
        AND is_valid = true
      `;

      return {
        certificates: result.rows as Certificate[],
        total: parseInt(String(countResult.rows[0].total)),
      };
    } catch (error) {
      console.error('Get user certificates error:', error);
      return { certificates: [], total: 0 };
    }
  }

  // Revoke certificate
  async revokeCertificate(certificateId: string, reason: string): Promise<boolean> {
    try {
      await sql`
        UPDATE certificates
        SET 
          is_valid = false,
          revocation_reason = ${reason},
          revoked_at = NOW(),
          updated_at = NOW()
        WHERE id = ${certificateId}
      `;

      // Notify user
      const certificate = await this.getCertificateById(certificateId);
      if (certificate) {
        await sql`
          INSERT INTO notifications (
            user_id, title, message, type, 
            reference_id, reference_type
          )
          VALUES (
            ${certificate.user_id},
            'Certificate Revoked',
            'Your certificate has been revoked. Reason: ${reason}',
            'certificate_revoked',
            ${certificateId},
            'certificate'
          )
        `;
      }

      return true;
    } catch (error) {
      console.error('Revoke certificate error:', error);
      return false;
    }
  }

  // Get certificate statistics
  async getCertificateStats(): Promise<{
    total_issued: number;
    issued_this_month: number;
    issued_today: number;
  }> {
    try {
      const result = await sql`
        SELECT 
          COUNT(*) as total_issued,
          COUNT(*) FILTER (
            WHERE issued_at >= DATE_TRUNC('month', CURRENT_DATE)
          ) as issued_this_month,
          COUNT(*) FILTER (
            WHERE issued_at >= CURRENT_DATE
          ) as issued_today
        FROM certificates
        WHERE is_valid = true
      `;

      return {
        total_issued: parseInt(String(result.rows[0].total_issued)),
        issued_this_month: parseInt(String(result.rows[0].issued_this_month)),
        issued_today: parseInt(String(result.rows[0].issued_today)),
      };
    } catch (error) {
      console.error('Get certificate stats error:', error);
      return {
        total_issued: 0,
        issued_this_month: 0,
        issued_today: 0,
      };
    }
  }
}

const certificateService = new CertificateService();
export default certificateService;
