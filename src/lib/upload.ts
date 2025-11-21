import multer from 'multer';
import path from 'path';
import { storageConfig } from '@/config/storage.config';
import { generateUniqueFilename } from '@/utils/file.util';

/**
 * Multer Storage Configuration for Local Storage
 */
const localStorage = multer.diskStorage({
  destination: (_req, file, cb) => {
    // Determine destination based on file type
    let destination = storageConfig.local.basePath;

    if (file.mimetype.startsWith('video/')) {
      destination = path.join(destination, storageConfig.local.directories.videos.originals);
    } else if (file.mimetype.startsWith('image/')) {
      destination = path.join(destination, storageConfig.local.directories.images.courses);
    } else {
      destination = path.join(destination, storageConfig.local.directories.documents.others);
    }

    cb(null, destination);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename
    const uniqueFilename = generateUniqueFilename(file.originalname);
    cb(null, uniqueFilename);
  },
});

/**
 * File Filter for Validation
 */
const fileFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  const allowedTypes = [
    ...storageConfig.limits.allowedVideoTypes,
    ...storageConfig.limits.allowedImageTypes,
    ...storageConfig.limits.allowedDocumentTypes,
  ];

  if (allowedTypes.includes(file.mimetype as (typeof allowedTypes)[number])) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`));
  }
};

/**
 * Video Upload Configuration
 */
export const videoUpload = multer({
  storage: localStorage,
  limits: {
    fileSize: storageConfig.limits.maxVideoSize,
  },
  fileFilter: (_req, file, cb) => {
    const videoTypes = storageConfig.limits.allowedVideoTypes;
    if ((videoTypes as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  },
});

/**
 * Image Upload Configuration
 */
export const imageUpload = multer({
  storage: localStorage,
  limits: {
    fileSize: storageConfig.limits.maxImageSize,
  },
  fileFilter: (_req, file, cb) => {
    const imageTypes = storageConfig.limits.allowedImageTypes;
    if ((imageTypes as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * Document Upload Configuration
 */
export const documentUpload = multer({
  storage: localStorage,
  limits: {
    fileSize: storageConfig.limits.maxDocumentSize,
  },
  fileFilter: (_req, file, cb) => {
    const documentTypes = storageConfig.limits.allowedDocumentTypes;
    if ((documentTypes as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only document files are allowed'));
    }
  },
});

/**
 * General Upload Configuration
 */
export const generalUpload = multer({
  storage: localStorage,
  limits: {
    fileSize: storageConfig.limits.maxVideoSize, // Use max size
  },
  fileFilter,
});

/**
 * Memory Storage (for processing before saving)
 */
export const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: storageConfig.limits.maxVideoSize,
  },
  fileFilter,
});

/**
 * Upload Handler Wrapper for Next.js API Routes
 */
export function uploadHandler(
  upload: multer.Multer,
  fieldName: string = 'file'
): (req: Express.Request, res: Express.Response) => Promise<void> {
  return (req: Express.Request, res: Express.Response) =>
    new Promise<void>((resolve, reject) => {
      upload.single(fieldName)(req as never, res as never, (err: unknown) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
}

/**
 * Multiple Files Upload Handler
 */
export function uploadMultipleHandler(
  upload: multer.Multer,
  fieldName: string = 'files',
  maxCount: number = 10
): (req: Express.Request, res: Express.Response) => Promise<void> {
  return (req: Express.Request, res: Express.Response) =>
    new Promise<void>((resolve, reject) => {
      upload.array(fieldName, maxCount)(req as never, res as never, (err: unknown) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
}
