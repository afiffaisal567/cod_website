import path from "path";
import sharp from "sharp";
import { storage } from "@/lib/storage";
import { storageConfig } from "@/config/storage.config";
import {
  generateUniqueFilename,
  formatFileSize,
  isVideoFile,
  isImageFile,
  isDocumentFile,
  validateFileSize,
} from "@/utils/file.util";
import { AppError } from "@/utils/error.util";
import { HTTP_STATUS } from "@/lib/constants";

interface UploadResult {
  filename: string;
  path: string;
  size: number;
  mimetype: string;
  url: string;
}

interface ImageUploadResult extends UploadResult {
  thumbnails?: Record<string, string>;
}

interface ProfilePictureResult {
  filename: string;
  path: string;
  url: string;
}

interface FileInfo {
  exists: boolean;
  url?: string;
}

/**
 * Upload Service
 * Handles file upload operations
 */
export class UploadService {
  /**
   * Upload video file
   */
  async uploadVideo(file: Express.Multer.File): Promise<UploadResult> {
    // Validate file type
    if (!isVideoFile(file.mimetype)) {
      throw new AppError("Invalid video file type", HTTP_STATUS.BAD_REQUEST);
    }

    // Validate file size
    if (!validateFileSize(file.size, storageConfig.limits.maxVideoSize)) {
      throw new AppError(
        `Video file too large. Max size: ${formatFileSize(
          storageConfig.limits.maxVideoSize
        )}`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Generate unique filename
    const filename = generateUniqueFilename(file.originalname);
    const filePath = path.join("videos", "originals", filename);

    // Save to storage
    if (file.buffer) {
      await storage.save(filePath, file.buffer);
    }

    return {
      filename,
      path: filePath,
      size: file.size,
      mimetype: file.mimetype,
      url: storage.getUrl(filePath),
    };
  }

  /**
   * Upload image file
   */
  async uploadImage(
    file: Express.Multer.File,
    options?: {
      resize?: { width?: number; height?: number };
      quality?: number;
      generateThumbnails?: boolean;
    }
  ): Promise<ImageUploadResult> {
    // Validate file type
    if (!isImageFile(file.mimetype)) {
      throw new AppError("Invalid image file type", HTTP_STATUS.BAD_REQUEST);
    }

    // Validate file size
    if (!validateFileSize(file.size, storageConfig.limits.maxImageSize)) {
      throw new AppError(
        `Image file too large. Max size: ${formatFileSize(
          storageConfig.limits.maxImageSize
        )}`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Generate unique filename
    const filename = generateUniqueFilename(file.originalname);
    const filePath = path.join("images", "courses", filename);

    // Process image
    let imageBuffer = file.buffer;

    if (options?.resize || options?.quality) {
      const processor = sharp(file.buffer);

      if (options.resize) {
        processor.resize({
          width: options.resize.width,
          height: options.resize.height,
          fit: "inside",
        });
      }

      if (options.quality) {
        processor.jpeg({ quality: options.quality });
      }

      imageBuffer = await processor.toBuffer();
    }

    // Save to storage
    await storage.save(filePath, imageBuffer);

    const result: ImageUploadResult = {
      filename,
      path: filePath,
      size: imageBuffer.length,
      mimetype: file.mimetype,
      url: storage.getUrl(filePath),
    };

    // Generate thumbnails if requested
    if (options?.generateThumbnails) {
      result.thumbnails = await this.generateImageThumbnails(
        file.buffer,
        filename
      );
    }

    return result;
  }

  /**
   * Generate image thumbnails
   */
  private async generateImageThumbnails(
    buffer: Buffer,
    originalFilename: string
  ): Promise<Record<string, string>> {
    const thumbnails: Record<string, string> = {};
    const sizes = storageConfig.image.thumbnails;

    for (const [sizeName, dimensions] of Object.entries(sizes)) {
      const thumbnailFilename = `thumb_${sizeName}_${originalFilename}`;
      const thumbnailPath = path.join(
        "images",
        "thumbnails",
        thumbnailFilename
      );

      const thumbnailBuffer = await sharp(buffer)
        .resize(dimensions.width, dimensions.height, {
          fit: "cover",
          position: "center",
        })
        .jpeg({ quality: storageConfig.image.quality })
        .toBuffer();

      await storage.save(thumbnailPath, thumbnailBuffer);
      thumbnails[sizeName] = storage.getUrl(thumbnailPath);
    }

    return thumbnails;
  }

  /**
   * Upload document file
   */
  async uploadDocument(file: Express.Multer.File): Promise<UploadResult> {
    // Validate file type
    if (!isDocumentFile(file.mimetype)) {
      throw new AppError("Invalid document file type", HTTP_STATUS.BAD_REQUEST);
    }

    // Validate file size
    if (!validateFileSize(file.size, storageConfig.limits.maxDocumentSize)) {
      throw new AppError(
        `Document file too large. Max size: ${formatFileSize(
          storageConfig.limits.maxDocumentSize
        )}`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Generate unique filename
    const filename = generateUniqueFilename(file.originalname);

    // Determine subdirectory based on file type
    let subdirectory = "others";
    if (file.mimetype === "application/pdf") {
      subdirectory = "pdfs";
    } else if (
      file.mimetype.includes("presentation") ||
      file.mimetype.includes("powerpoint")
    ) {
      subdirectory = "presentations";
    }

    const filePath = path.join("documents", subdirectory, filename);

    // Save to storage
    if (file.buffer) {
      await storage.save(filePath, file.buffer);
    }

    return {
      filename,
      path: filePath,
      size: file.size,
      mimetype: file.mimetype,
      url: storage.getUrl(filePath),
    };
  }

  /**
   * Upload profile picture
   */
  async uploadProfilePicture(
    file: Express.Multer.File
  ): Promise<ProfilePictureResult> {
    // Validate and process image
    if (!isImageFile(file.mimetype)) {
      throw new AppError("Invalid image file type", HTTP_STATUS.BAD_REQUEST);
    }

    const filename = generateUniqueFilename(file.originalname);
    const filePath = path.join("images", "profiles", filename);

    // Resize and optimize profile picture
    const processedBuffer = await sharp(file.buffer)
      .resize(400, 400, {
        fit: "cover",
        position: "center",
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    await storage.save(filePath, processedBuffer);

    return {
      filename,
      path: filePath,
      url: storage.getUrl(filePath),
    };
  }

  /**
   * Delete file
   */
  async deleteFile(filePath: string): Promise<void> {
    const exists = await storage.exists(filePath);

    if (!exists) {
      throw new AppError("File not found", HTTP_STATUS.NOT_FOUND);
    }

    await storage.delete(filePath);
  }

  /**
   * Get file info
   */
  async getFileInfo(filePath: string): Promise<FileInfo> {
    const exists = await storage.exists(filePath);

    return {
      exists,
      url: exists ? storage.getUrl(filePath) : undefined,
    };
  }
}

const uploadService = new UploadService();
export default uploadService;
