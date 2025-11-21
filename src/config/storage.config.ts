import path from 'path';

/**
 * Storage Configuration
 * File upload and storage settings
 */

export const storageConfig = {
  // Storage Type (local, s3, cloudinary)
  type: (process.env.STORAGE_TYPE || 'local') as 'local' | 's3' | 'cloudinary',

  // Local Storage Settings
  local: {
    basePath: path.join(process.cwd(), 'uploads'),
    publicPath: '/uploads',

    // Directory Structure
    directories: {
      videos: {
        originals: 'videos/originals',
        processed: 'videos/processed',
        thumbnails: 'videos/thumbnails',
        temp: 'videos/temp',
      },
      images: {
        profiles: 'images/profiles',
        courses: 'images/courses',
        certificates: 'images/certificates',
      },
      documents: {
        pdfs: 'documents/pdfs',
        presentations: 'documents/presentations',
        others: 'documents/others',
      },
    },
  },

  // AWS S3 Settings
  s3: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'ap-southeast-1',
    bucket: process.env.AWS_BUCKET_NAME || '',

    // S3 Options
    options: {
      signatureVersion: 'v4',
      s3ForcePathStyle: false,
      accelerateEndpoint: false,
    },

    // CDN URL (CloudFront)
    cdnUrl: process.env.AWS_CDN_URL || '',
  },

  // Cloudinary Settings (alternative)
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  // Upload Limits
  limits: {
    // File Size Limits (in bytes)
    maxVideoSize: parseInt(process.env.UPLOAD_MAX_SIZE || '52428800', 10), // 50MB
    maxImageSize: 5 * 1024 * 1024, // 5MB
    maxDocumentSize: 10 * 1024 * 1024, // 10MB

    // Allowed File Types
    allowedVideoTypes: ['video/mp4', 'video/webm', 'video/ogg'],
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    allowedDocumentTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },

  // Image Processing
  image: {
    quality: 85,
    maxWidth: 1920,
    maxHeight: 1080,

    // Thumbnail Sizes
    thumbnails: {
      small: { width: 150, height: 150 },
      medium: { width: 300, height: 300 },
      large: { width: 600, height: 600 },
    },

    // Formats
    formats: ['jpeg', 'png', 'webp'],
  },

  // Cleanup Settings
  cleanup: {
    enabled: true,
    tempFileMaxAge: 24 * 60 * 60 * 1000, // 24 hours
    deletedFileRetention: 7 * 24 * 60 * 60 * 1000, // 7 days
    autoCleanup: true,
    cleanupInterval: 24 * 60 * 60 * 1000, // Daily
  },

  // Security
  security: {
    enableVirusScan: false,
    allowedOrigins: ['*'],
    csrfProtection: true,
  },
} as const;

export type StorageConfig = typeof storageConfig;

export default storageConfig;
