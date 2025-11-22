// services/email.service.ts
import nodemailer from "nodemailer";

// Konfigurasi Email
const emailConfig = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  from: {
    name: "Course Online Disabilitas",
    address: process.env.EMAIL_FROM || "noreply@example.com",
  },
};

// Interface untuk Email Options
interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Email Result Interface
export interface EmailResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Email Service Class
 * Menangani pengiriman email menggunakan Nodemailer dengan connection pooling
 */
export class EmailService {
  private transporter: nodemailer.Transporter;
  private isConnected: boolean = false;
  private connectionPromise: Promise<boolean> | null = null;
  private maxRetries: number = 3;
  private retryDelay: number = 2000; // 2 detik

  constructor() {
    console.log("📧 Initializing Email Service...");
    console.log("🔧 SMTP Config:", {
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      user: emailConfig.auth.user,
      hasPassword: !!emailConfig.auth.pass,
    });

    this.transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: {
        user: emailConfig.auth.user,
        pass: emailConfig.auth.pass,
      },
      connectionTimeout: 10000, // 10 detik
      greetingTimeout: 10000,
      socketTimeout: 15000,
      // Pooling configuration untuk koneksi yang lebih stabil
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });

    // Handle transporter events
    this.setupTransporterEvents();

    // Initialize connection (async, tidak blocking)
    this.initializeConnection();
  }

  /**
   * Setup event handlers untuk transporter
   */
  private setupTransporterEvents(): void {
    // Hanya gunakan event yang tersedia di Nodemailer
    this.transporter.on("idle", () => {
      console.log("📧 Email transporter is idle");
    });

    this.transporter.on("error", (error: Error) => {
      console.error("❌ Email transporter error:", error);
      this.isConnected = false;
    });

    // Event 'end' tidak tersedia di Nodemailer, jadi dihapus
  }

  /**
   * Initialize connection dengan retry mechanism
   */
  private async initializeConnection(): Promise<void> {
    if (this.connectionPromise) {
      return;
    }

    this.connectionPromise = this.connectWithRetry();

    try {
      const connected = await this.connectionPromise;
      if (connected) {
        console.log("🎉 Email service initialized successfully!");
      } else {
        console.error("💥 Email service failed to initialize after retries");
      }
    } catch (error) {
      console.error("💥 Email service initialization error:", error);
    } finally {
      this.connectionPromise = null;
    }
  }

  /**
   * Connect dengan retry mechanism
   */
  private async connectWithRetry(retryCount: number = 0): Promise<boolean> {
    try {
      console.log(
        `🔄 Attempting SMTP connection (attempt ${retryCount + 1}/${
          this.maxRetries
        })...`
      );

      await this.transporter.verify();
      this.isConnected = true;

      console.log("✅ SMTP Connection verified successfully!");
      console.log("📧 Email Service is ready to send emails");
      return true;
    } catch (error) {
      console.error(
        `❌ SMTP Connection failed (attempt ${retryCount + 1}/${
          this.maxRetries
        }):`,
        error
      );

      if (retryCount < this.maxRetries - 1) {
        console.log(`⏳ Retrying in ${this.retryDelay / 1000} seconds...`);
        await this.delay(this.retryDelay);
        return this.connectWithRetry(retryCount + 1);
      } else {
        console.error("💥 Max retries reached. SMTP connection failed.");
        this.isConnected = false;
        return false;
      }
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Wait for connection to be ready
   */
  private async waitForConnection(): Promise<boolean> {
    // Jika sudah connected, langsung return
    if (this.isConnected) {
      return true;
    }

    // Jika sedang proses koneksi, tunggu
    if (this.connectionPromise) {
      console.log("⏳ Waiting for existing connection process...");
      return await this.connectionPromise;
    }

    // Jika tidak connected dan tidak ada proses koneksi, buat koneksi baru
    console.log("🔄 Connection not ready, initializing new connection...");
    await this.initializeConnection();
    return this.isConnected;
  }

  /**
   * Send email dengan connection waiting
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      console.log("📤 Preparing to send email to:", options.to);

      // Tunggu koneksi siap
      const isReady = await this.waitForConnection();

      if (!isReady) {
        const errorMsg =
          "SMTP connection not established after waiting. Email cannot be sent.";
        console.error("❌", errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }

      console.log("✅ Connection ready, sending email...");
      console.log("📝 Subject:", options.subject);

      const mailOptions = {
        from: `${emailConfig.from.name} <${emailConfig.from.address}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html),
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log("✅ Email sent successfully!");
      console.log("📨 Message ID:", info.messageId);
      console.log("📤 Response:", info.response);

      return {
        success: true,
        message: `Email sent successfully to ${options.to}`,
      };
    } catch (error: any) {
      console.error("❌ Error sending email:", error);

      // Reset connection status jika error
      this.isConnected = false;

      let errorMessage = "Unknown error occurred";

      if (error.code === "EAUTH") {
        errorMessage = "Authentication failed. Check email credentials.";
      } else if (error.code === "ECONNECTION") {
        errorMessage = "Connection to SMTP server failed.";
      } else if (error.code === "ETIMEDOUT") {
        errorMessage = "SMTP connection timed out.";
      } else if (error.code === "EENVELOPE") {
        errorMessage = "Envelope error. Check recipient email address.";
      } else {
        errorMessage = error.message || "Failed to send email";
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Convert HTML to plain text (fallback)
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(
    to: string,
    userName: string,
    token: string
  ): Promise<EmailResult> {
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const verificationUrl = `${appUrl}/verify-email?token=${token}`;

    const subject = "Verify Your Email Address - Course Online Disabilitas";

    const html = this.generateVerificationTemplate(userName, verificationUrl);
    const text = `Hi ${userName},\n\nPlease verify your email address by clicking the link below:\n\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you didn't create an account, please ignore this email.`;

    console.log("🔐 Sending verification email to:", to);
    console.log("🔗 Verification URL:", verificationUrl);

    const result = await this.sendEmail({
      to,
      subject,
      html,
      text,
    });

    if (result.success) {
      console.log("✅ Verification email sent successfully to:", to);
    } else {
      console.error(
        "❌ Failed to send verification email to:",
        to,
        result.error
      );
    }

    return result;
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    to: string,
    userName: string,
    token: string
  ): Promise<EmailResult> {
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    const subject = "Reset Your Password - Course Online Disabilitas";

    const html = this.generatePasswordResetTemplate(userName, resetUrl);
    const text = `Hi ${userName},\n\nYou requested to reset your password. Click the link below to set a new password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.`;

    console.log("🔑 Sending password reset email to:", to);
    console.log("🔗 Reset URL:", resetUrl);

    const result = await this.sendEmail({
      to,
      subject,
      html,
      text,
    });

    if (result.success) {
      console.log("✅ Password reset email sent successfully to:", to);
    } else {
      console.error(
        "❌ Failed to send password reset email to:",
        to,
        result.error
      );
    }

    return result;
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(to: string, userName: string): Promise<EmailResult> {
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const subject = "Welcome to Course Online Disabilitas!";

    const html = this.generateWelcomeTemplate(userName, appUrl);
    const text = `Hi ${userName},\n\nWelcome to Course Online Disabilitas! We're excited to have you on board.\n\nStart exploring our courses and begin your learning journey today.\n\nIf you have any questions, feel free to reach out to our support team.\n\nHappy learning!`;

    console.log("👋 Sending welcome email to:", to);

    const result = await this.sendEmail({
      to,
      subject,
      html,
      text,
    });

    return result;
  }

  /**
   * Template Generators
   */
  private generateVerificationTemplate(
    userName: string,
    verificationUrl: string
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
          <style>
              body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  margin: 0;
                  padding: 0;
                  background-color: #f9fafb;
              }
              .container {
                  max-width: 600px;
                  margin: 0 auto;
                  background: #ffffff;
                  border-radius: 8px;
                  overflow: hidden;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              .header {
                  background: linear-gradient(135deg, #4F46E5, #7E22CE);
                  color: white;
                  padding: 30px 20px;
                  text-align: center;
              }
              .header h1 {
                  margin: 0;
                  font-size: 24px;
                  font-weight: 600;
              }
              .content {
                  padding: 30px;
              }
              .greeting {
                  font-size: 18px;
                  margin-bottom: 20px;
                  color: #374151;
              }
              .message {
                  margin-bottom: 25px;
                  color: #6B7280;
              }
              .button {
                  display: inline-block;
                  padding: 14px 28px;
                  background: linear-gradient(135deg, #4F46E5, #7E22CE);
                  color: white;
                  text-decoration: none;
                  border-radius: 6px;
                  font-weight: 600;
                  text-align: center;
                  margin: 20px 0;
              }
              .verification-link {
                  background: #f3f4f6;
                  padding: 15px;
                  border-radius: 6px;
                  word-break: break-all;
                  font-family: monospace;
                  font-size: 14px;
                  color: #374151;
                  margin: 20px 0;
              }
              .footer {
                  padding: 20px;
                  text-align: center;
                  color: #9CA3AF;
                  font-size: 14px;
                  border-top: 1px solid #E5E7EB;
              }
              .warning {
                  background: #FEF3C7;
                  border: 1px solid #F59E0B;
                  padding: 15px;
                  border-radius: 6px;
                  margin: 20px 0;
                  color: #92400E;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>Verify Your Email Address</h1>
              </div>
              <div class="content">
                  <div class="greeting">Hi ${userName},</div>
                  
                  <div class="message">
                      Thank you for signing up! Please verify your email address to activate your account and start using our platform.
                  </div>

                  <div style="text-align: center;">
                      <a href="${verificationUrl}" class="button">Verify Email Address</a>
                  </div>

                  <div class="message">
                      Or copy and paste this link in your browser:
                  </div>

                  <div class="verification-link">
                      ${verificationUrl}
                  </div>

                  <div class="warning">
                      <strong>Important:</strong> This verification link will expire in 24 hours.
                  </div>

                  <div class="message">
                      If you didn't create an account with us, please ignore this email.
                  </div>
              </div>
              <div class="footer">
                  <p>&copy; ${new Date().getFullYear()} Course Online Disabilitas. All rights reserved.</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  private generatePasswordResetTemplate(
    userName: string,
    resetUrl: string
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
          <style>
              body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  margin: 0;
                  padding: 0;
                  background-color: #f9fafb;
              }
              .container {
                  max-width: 600px;
                  margin: 0 auto;
                  background: #ffffff;
                  border-radius: 8px;
                  overflow: hidden;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              .header {
                  background: linear-gradient(135deg, #DC2626, #EF4444);
                  color: white;
                  padding: 30px 20px;
                  text-align: center;
              }
              .header h1 {
                  margin: 0;
                  font-size: 24px;
                  font-weight: 600;
              }
              .content {
                  padding: 30px;
              }
              .greeting {
                  font-size: 18px;
                  margin-bottom: 20px;
                  color: #374151;
              }
              .message {
                  margin-bottom: 25px;
                  color: #6B7280;
              }
              .button {
                  display: inline-block;
                  padding: 14px 28px;
                  background: linear-gradient(135deg, #DC2626, #EF4444);
                  color: white;
                  text-decoration: none;
                  border-radius: 6px;
                  font-weight: 600;
                  text-align: center;
                  margin: 20px 0;
              }
              .reset-link {
                  background: #f3f4f6;
                  padding: 15px;
                  border-radius: 6px;
                  word-break: break-all;
                  font-family: monospace;
                  font-size: 14px;
                  color: #374151;
                  margin: 20px 0;
              }
              .footer {
                  padding: 20px;
                  text-align: center;
                  color: #9CA3AF;
                  font-size: 14px;
                  border-top: 1px solid #E5E7EB;
              }
              .warning {
                  background: #FEF3C7;
                  border: 1px solid #F59E0B;
                  padding: 15px;
                  border-radius: 6px;
                  margin: 20px 0;
                  color: #92400E;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>Reset Your Password</h1>
              </div>
              <div class="content">
                  <div class="greeting">Hi ${userName},</div>
                  
                  <div class="message">
                      We received a request to reset your password for your Course Online Disabilitas account.
                  </div>

                  <div style="text-align: center;">
                      <a href="${resetUrl}" class="button">Reset Password</a>
                  </div>

                  <div class="message">
                      Or copy and paste this link in your browser:
                  </div>

                  <div class="reset-link">
                      ${resetUrl}
                  </div>

                  <div class="warning">
                      <strong>Important:</strong> This password reset link will expire in 1 hour.
                  </div>

                  <div class="message">
                      If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
                  </div>
              </div>
              <div class="footer">
                  <p>&copy; ${new Date().getFullYear()} Course Online Disabilitas. All rights reserved.</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  private generateWelcomeTemplate(userName: string, appUrl: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Course Online Disabilitas</title>
          <style>
              body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  margin: 0;
                  padding: 0;
                  background-color: #f9fafb;
              }
              .container {
                  max-width: 600px;
                  margin: 0 auto;
                  background: #ffffff;
                  border-radius: 8px;
                  overflow: hidden;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              .header {
                  background: linear-gradient(135deg, #059669, #10B981);
                  color: white;
                  padding: 30px 20px;
                  text-align: center;
              }
              .header h1 {
                  margin: 0;
                  font-size: 24px;
                  font-weight: 600;
              }
              .content {
                  padding: 30px;
              }
              .greeting {
                  font-size: 18px;
                  margin-bottom: 20px;
                  color: #374151;
              }
              .message {
                  margin-bottom: 25px;
                  color: #6B7280;
              }
              .button {
                  display: inline-block;
                  padding: 14px 28px;
                  background: linear-gradient(135deg, #059669, #10B981);
                  color: white;
                  text-decoration: none;
                  border-radius: 6px;
                  font-weight: 600;
                  text-align: center;
                  margin: 20px 0;
              }
              .features {
                  margin: 25px 0;
              }
              .feature {
                  display: flex;
                  align-items: center;
                  margin-bottom: 15px;
              }
              .feature-icon {
                  background: #10B981;
                  color: white;
                  border-radius: 50%;
                  width: 24px;
                  height: 24px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin-right: 15px;
                  font-size: 14px;
              }
              .footer {
                  padding: 20px;
                  text-align: center;
                  color: #9CA3AF;
                  font-size: 14px;
                  border-top: 1px solid #E5E7EB;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>Welcome to Course Online Disabilitas!</h1>
              </div>
              <div class="content">
                  <div class="greeting">Hi ${userName},</div>
                  
                  <div class="message">
                      Welcome to our platform! We're excited to have you join our community of learners.
                  </div>

                  <div class="features">
                      <div class="feature">
                          <div class="feature-icon">✓</div>
                          <span>Access to specialized courses for different abilities</span>
                      </div>
                      <div class="feature">
                          <div class="feature-icon">✓</div>
                          <span>Learn at your own pace with flexible scheduling</span>
                      </div>
                      <div class="feature">
                          <div class="feature-icon">✓</div>
                          <span>Connect with mentors and fellow students</span>
                      </div>
                      <div class="feature">
                          <div class="feature-icon">✓</div>
                          <span>Earn certificates upon course completion</span>
                      </div>
                  </div>

                  <div style="text-align: center;">
                      <a href="${appUrl}/courses" class="button">Explore Courses</a>
                  </div>

                  <div class="message">
                      If you have any questions or need assistance, feel free to contact our support team.
                  </div>

                  <div class="message">
                      Happy learning!<br>
                      The Course Online Disabilitas Team
                  </div>
              </div>
              <div class="footer">
                  <p>&copy; ${new Date().getFullYear()} Course Online Disabilitas. All rights reserved.</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  /**
   * Check email service status
   */
  getStatus(): { connected: boolean; config: any } {
    return {
      connected: this.isConnected,
      config: {
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        user: emailConfig.auth.user,
        hasPassword: !!emailConfig.auth.pass,
      },
    };
  }

  /**
   * Test email connection
   */
  async testConnection(): Promise<EmailResult> {
    try {
      console.log("🧪 Testing email connection...");
      const isReady = await this.waitForConnection();

      if (isReady) {
        return {
          success: true,
          message: "Email service is connected and ready",
        };
      } else {
        return {
          success: false,
          error: "Email service is not connected",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Export singleton instance
const emailService = new EmailService();
export default emailService;
