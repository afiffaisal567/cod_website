import nodemailer from 'nodemailer';
import { emailConfig } from '@/config/email.config';

/**
 * Email Transporter
 * Nodemailer configuration
 */
export const emailTransporter = nodemailer.createTransport({
  host: emailConfig.smtp.host,
  port: emailConfig.smtp.port,
  secure: emailConfig.smtp.secure,
  auth: {
    user: emailConfig.smtp.auth.user,
    pass: emailConfig.smtp.auth.pass,
  },
});

/**
 * Email Attachment Interface
 */
interface EmailAttachment {
  filename: string;
  content?: string | Buffer;
  path?: string;
}

/**
 * Email Options Interface
 */
export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

/**
 * Send Email
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  // Override recipient in development
  const to = emailConfig.development.catchAll ? emailConfig.development.catchAllEmail : options.to;

  // Log email in development
  if (emailConfig.development.logEmails) {
    console.log('📧 Sending email:', {
      to: options.to,
      subject: options.subject,
    });
  }

  await emailTransporter.sendMail({
    from: `${emailConfig.from.name} <${emailConfig.from.address}>`,
    to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    attachments: options.attachments,
    replyTo: `${emailConfig.replyTo.name} <${emailConfig.replyTo.address}>`,
  });
}

/**
 * Verify Email Connection
 */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    await emailTransporter.verify();
    console.log('✅ Email server connection verified');
    return true;
  } catch (error) {
    console.error('❌ Email server connection failed:', error);
    return false;
  }
}

const emailModule = {
  transporter: emailTransporter,
  sendEmail,
  verifyEmailConnection,
};

export default emailModule;
