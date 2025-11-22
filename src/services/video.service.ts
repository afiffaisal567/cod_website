import path from "path";
import fs from "fs/promises";
import { videoConfig } from "@/config/video.config";
import { storage } from "@/lib/storage";
import videoProcessor from "@/utils/video-processor.util";
import {
  ensureDirectoryExists,
  deleteFile,
  fileExists,
} from "@/utils/file.util";
import { logInfo, logError } from "@/utils/logger.util";
import type { VideoQuality, VideoProcessingOptions } from "@/types/video.types";
import prisma from "@/lib/prisma";

/**
 * Video Service
 * Menangani upload, processing, dan manajemen video secara synchronous
 */
export class VideoService {
  /**
   * Process video secara synchronous (tanpa queue)
   */
  async processVideo(
    videoId: string,
    inputPath: string,
    options?: VideoProcessingOptions
  ): Promise<void> {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      throw new Error("Video not found");
    }

    try {
      logInfo(`Starting video processing`, { videoId });

      // Update status to PROCESSING
      await prisma.video.update({
        where: { id: videoId },
        data: { status: "PROCESSING" },
      });

      // Get video metadata
      const metadata = await videoProcessor.getMetadata(inputPath);

      // Update video dengan metadata
      await prisma.video.update({
        where: { id: videoId },
        data: {
          duration: Math.floor(metadata.duration),
          size: metadata.size,
          mime_type: metadata.format,
        },
      });

      // Process different qualities
      const qualities =
        options?.qualities || (["360p", "720p"] as VideoQuality[]);
      const processedQualities = [];

      for (const quality of qualities) {
        try {
          const outputPath = await this.convertToQuality(
            videoId,
            inputPath,
            quality
          );

          processedQualities.push({
            quality,
            path: outputPath,
            size: metadata.size, // Akan diupdate nanti
            bitrate:
              videoConfig.resolutions.find((r) => r.name === quality)
                ?.bitrate || "1000k",
            resolution: quality,
          });

          logInfo(`Video quality processed`, { videoId, quality });
        } catch (error) {
          logError(`Failed to process quality ${quality}`, error);
          // Continue with other qualities
        }
      }

      // Generate thumbnails jika diperlukan
      let thumbnailPath: string | undefined;
      if (options?.generateThumbnails !== false) {
        try {
          thumbnailPath = await this.generateThumbnails(videoId, inputPath);
        } catch (error) {
          logError("Failed to generate thumbnails", error);
        }
      }

      // Simpan data qualities ke database
      for (const qualityData of processedQualities) {
        await prisma.videoQuality_Model.create({
          data: {
            video_id: videoId,
            quality: qualityData.quality,
            path: qualityData.path,
            size: qualityData.size,
            bitrate: qualityData.bitrate,
            resolution: qualityData.resolution,
          },
        });
      }

      // Update video status to COMPLETED
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: "COMPLETED",
          thumbnail: thumbnailPath,
        },
      });

      // Delete original file jika diperlukan
      if (options?.deleteOriginal) {
        try {
          await deleteFile(inputPath);
        } catch (error) {
          logError("Failed to delete original file", error);
        }
      }

      logInfo(`Video processing completed`, { videoId });
    } catch (error) {
      logError(`Video processing failed`, error);

      // Update status to FAILED
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: "FAILED",
          processing_error:
            error instanceof Error ? error.message : "Unknown error",
        },
      });

      throw error;
    }
  }

  /**
   * Convert video to specific quality
   */
  private async convertToQuality(
    videoId: string,
    inputPath: string,
    quality: VideoQuality
  ): Promise<string> {
    const outputFilename = `${videoId}-${quality}.mp4`;
    const outputPath = path.join(
      "videos",
      "processed",
      quality,
      outputFilename
    );

    const fullOutputPath = path.join(process.cwd(), "uploads", outputPath);

    await ensureDirectoryExists(path.dirname(fullOutputPath));

    await videoProcessor.convertToQuality(inputPath, fullOutputPath, quality);

    return outputPath;
  }

  /**
   * Generate thumbnails
   */
  private async generateThumbnails(
    videoId: string,
    inputPath: string
  ): Promise<string> {
    const outputDir = path.join(
      process.cwd(),
      "uploads",
      "videos",
      "thumbnails",
      videoId
    );

    await ensureDirectoryExists(outputDir);

    const thumbnails = await videoProcessor.generateThumbnails(
      inputPath,
      outputDir,
      {
        count: 3,
        size: "320x180",
        format: "jpg",
        quality: 80,
      }
    );

    // Return first thumbnail path relative to uploads directory
    return thumbnails[0]
      ? path.relative(path.join(process.cwd(), "uploads"), thumbnails[0])
      : "";
  }

  /**
   * Get video stream info
   */
  async getVideoStream(videoId: string, quality?: VideoQuality) {
    let videoPath: string;

    if (quality) {
      const qualityRecord = await prisma.videoQuality_Model.findFirst({
        where: {
          video_id: videoId,
          quality: quality,
        },
      });

      if (!qualityRecord) {
        throw new Error(`Quality ${quality} not found for video ${videoId}`);
      }

      videoPath = qualityRecord.path;
    } else {
      const video = await prisma.video.findUnique({
        where: { id: videoId },
      });

      if (!video) {
        throw new Error("Video not found");
      }

      videoPath = video.path;
    }

    const fullPath = path.join(process.cwd(), "uploads", videoPath);

    if (!(await fileExists(fullPath))) {
      throw new Error("Video file not found");
    }

    return {
      path: fullPath,
      size: (await fs.stat(fullPath)).size,
      mimetype: "video/mp4",
    };
  }

  /**
   * Delete video and all its qualities
   */
  async deleteVideo(videoId: string): Promise<void> {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        qualities: true,
      },
    });

    if (!video) {
      throw new Error("Video not found");
    }

    // Delete files
    const filesToDelete = [
      path.join(process.cwd(), "uploads", video.path),
      ...video.qualities.map((q: any) =>
        path.join(process.cwd(), "uploads", q.path)
      ),
    ];

    if (video.thumbnail) {
      filesToDelete.push(path.join(process.cwd(), "uploads", video.thumbnail));
    }

    for (const filePath of filesToDelete) {
      try {
        await deleteFile(filePath);
      } catch (error) {
        logError(`Failed to delete file: ${filePath}`, error);
      }
    }

    // Delete from database
    await prisma.videoQuality_Model.deleteMany({
      where: { video_id: videoId },
    });

    await prisma.video.delete({
      where: { id: videoId },
    });

    logInfo(`Video deleted successfully`, { videoId });
  }
}

// Export singleton instance
const videoService = new VideoService();
export default videoService;
