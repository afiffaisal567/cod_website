export const emailConfig = {
  // SMTP Settings
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASSWORD || '',
    },
  },

  // Email Settings
  from: {
    name: process.env.APP_NAME || 'LMS Platform',
    address: process.env.EMAIL_FROM || 'noreply@lmsplatform.com',
  },

  // Reply-To
  replyTo: {
    name: 'Support Team',
    address: 'support@lmsplatform.com',
  },

  // Email Templates Path
  templates: {
    path: './src/templates/emails',
    engine: 'handlebars',
  },

  // Email Queue Settings
  queue: {
    enabled: true,
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
    batchSize: 10,
  },

  // Email Types
  types: {
    welcome: {
      subject: 'Welcome to LMS Platform',
      template: 'welcome',
    },
    verifyEmail: {
      subject: 'Verify Your Email Address',
      template: 'verify-email',
    },
    resetPassword: {
      subject: 'Reset Your Password',
      template: 'reset-password',
    },
    courseEnrollment: {
      subject: 'Course Enrollment Confirmation',
      template: 'course-enrollment',
    },
    certificateIssued: {
      subject: 'Your Certificate is Ready',
      template: 'certificate-issued',
    },
    paymentSuccess: {
      subject: 'Payment Successful',
      template: 'payment-success',
    },
    paymentFailed: {
      subject: 'Payment Failed',
      template: 'payment-failed',
    },
    mentorApproved: {
      subject: 'Your Mentor Application Approved',
      template: 'mentor-approved',
    },
    mentorRejected: {
      subject: 'Mentor Application Status',
      template: 'mentor-rejected',
    },
  },

  // Rate Limiting
  rateLimit: {
    maxEmailsPerHour: 100,
    maxEmailsPerDay: 500,
  },

  // Development Settings
  development: {
    catchAll: process.env.NODE_ENV === 'development',
    catchAllEmail: 'dev@lmsplatform.com',
    logEmails: true,
  },
} as const;

export type EmailConfig = typeof emailConfig;

export default emailConfig;
