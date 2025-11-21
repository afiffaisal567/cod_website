import { sendEmail, EmailOptions } from '@/lib/email';
import { emailQueue } from '@/lib/queue';
import { emailConfig } from '@/config/email.config';
import { appConfig } from '@/config/app.config';

/**
 * Email Service
 */
export class EmailService {
  /**
   * Send email immediately
   */
  async sendNow(options: EmailOptions): Promise<void> {
    await sendEmail(options);
  }

  /**
   * Queue email for background sending
   */
  async queue(options: EmailOptions, priority?: number): Promise<void> {
    await emailQueue.add('send-email', options as Record<string, unknown>, {
      priority: priority || 5,
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(to: string, userName: string): Promise<void> {
    const html = this.generateWelcomeTemplate(userName);

    await this.queue({
      to,
      subject: emailConfig.types.welcome.subject,
      html,
    });
  }

  /**
   * Send email verification
   */
  async sendVerificationEmail(to: string, userName: string, token: string): Promise<void> {
    const verificationUrl = `${appConfig.url}/verify-email?token=${token}`;
    const html = this.generateVerificationTemplate(userName, verificationUrl);

    await this.queue({
      to,
      subject: emailConfig.types.verifyEmail.subject,
      html,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(to: string, userName: string, token: string): Promise<void> {
    const resetUrl = `${appConfig.url}/reset-password?token=${token}`;
    const html = this.generatePasswordResetTemplate(userName, resetUrl);

    await this.queue({
      to,
      subject: emailConfig.types.resetPassword.subject,
      html,
    });
  }

  /**
   * Send course enrollment confirmation
   */
  async sendCourseEnrollmentEmail(to: string, userName: string, courseName: string): Promise<void> {
    const html = this.generateCourseEnrollmentTemplate(userName, courseName);

    await this.queue({
      to,
      subject: emailConfig.types.courseEnrollment.subject,
      html,
    });
  }

  /**
   * Send certificate issued email
   */
  async sendCertificateEmail(
    to: string,
    userName: string,
    courseName: string,
    certificateUrl: string
  ): Promise<void> {
    const html = this.generateCertificateTemplate(userName, courseName, certificateUrl);

    await this.queue({
      to,
      subject: emailConfig.types.certificateIssued.subject,
      html,
    });
  }

  /**
   * Send payment success email
   */
  async sendPaymentSuccessEmail(
    to: string,
    userName: string,
    amount: number,
    courseName: string
  ): Promise<void> {
    const html = this.generatePaymentSuccessTemplate(userName, amount, courseName);

    await this.queue({
      to,
      subject: emailConfig.types.paymentSuccess.subject,
      html,
    });
  }

  /**
   * Send mentor application approved email
   */
  async sendMentorApprovedEmail(to: string, userName: string): Promise<void> {
    const html = this.generateMentorApprovedTemplate(userName);

    await this.queue({
      to,
      subject: emailConfig.types.mentorApproved.subject,
      html,
    });
  }

  /**
   * Send mentor application rejected email
   */
  async sendMentorRejectedEmail(to: string, userName: string, reason: string): Promise<void> {
    const html = this.generateMentorRejectedTemplate(userName, reason);

    await this.queue({
      to,
      subject: emailConfig.types.mentorRejected.subject,
      html,
    });
  }

  // ========================================
  // EMAIL TEMPLATES
  // ========================================

  private generateWelcomeTemplate(userName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${appConfig.name}!</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>Welcome to ${appConfig.name}! We're excited to have you on board.</p>
            <p>Start exploring our courses and begin your learning journey today.</p>
            <a href="${appConfig.url}/courses" class="button">Browse Courses</a>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p>Happy learning!</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateVerificationTemplate(userName: string, verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verify Your Email</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>Please verify your email address to activate your account.</p>
            <a href="${verificationUrl}" class="button">Verify Email</a>
            <p>Or copy this link: ${verificationUrl}</p>
            <p>This link will expire in 24 hours.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generatePasswordResetTemplate(userName: string, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Password</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>You requested to reset your password. Click the button below to set a new password.</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>Or copy this link: ${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateCourseEnrollmentTemplate(userName: string, courseName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background: #10B981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Enrollment Confirmed!</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>You've successfully enrolled in <strong>${courseName}</strong>!</p>
            <p>Start learning now and unlock your potential.</p>
            <a href="${appConfig.url}/my-courses" class="button">Start Learning</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateCertificateTemplate(
    userName: string,
    courseName: string,
    certificateUrl: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #F59E0B; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background: #F59E0B; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Certificate Ready!</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>Congratulations! You've completed <strong>${courseName}</strong>.</p>
            <p>Your certificate is ready to download.</p>
            <a href="${certificateUrl}" class="button">Download Certificate</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generatePaymentSuccessTemplate(
    userName: string,
    amount: number,
    courseName: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Successful!</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>Your payment of <strong>Rp${amount.toLocaleString()}</strong> for <strong>${courseName}</strong> was successful.</p>
            <p>You can now access the course content.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateMentorApprovedTemplate(userName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background: #10B981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Application Approved!</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>Congratulations! Your mentor application has been approved.</p>
            <p>You can now create and publish courses.</p>
            <a href="${appConfig.url}/mentor/dashboard" class="button">Go to Dashboard</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateMentorRejectedTemplate(userName: string, reason: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #EF4444; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Application Update</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>Unfortunately, your mentor application was not approved at this time.</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p>You can reapply after addressing the feedback.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

// Export singleton instance
const emailService = new EmailService();
export default emailService;
