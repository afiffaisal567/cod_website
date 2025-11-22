import { spawn } from "child_process";
import { promisify } from "util";
import { videoConfig } from "@/config/video.config";
import type {
  VideoMetadata,
  VideoQuality,
  ThumbnailOptions,
} from "@/types/video.types";

const exec = promisify(require("child_process").exec);

/**
 * Video Processor Utility
 * Handles video processing using FFmpeg
 */
export class VideoProcessor {
  /**
   * Get video metadata using FFprobe
   */
  async getMetadata(filePath: string): Promise<VideoMetadata> {
    try {
      const { stdout } = await exec(
        `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`
      );

      const data = JSON.parse(stdout);
      const videoStream = data.streams.find(
        (stream: any) => stream.codec_type === "video"
      );
      const format = data.format;

      if (!videoStream || !format) {
        throw new Error("Could not extract video metadata");
      }

      return {
        duration: parseFloat(format.duration) || 0,
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        bitrate: format.bit_rate
          ? `${Math.round(parseInt(format.bit_rate) / 1000)}k`
          : "0k",
        codec: videoStream.codec_name || "unknown",
        format: format.format_name || "unknown",
        size: parseInt(format.size) || 0,
        fps: videoStream.r_frame_rate
          ? this.parseFrameRate(videoStream.r_frame_rate)
          : 30,
      };
    } catch (error) {
      throw new Error(`Failed to get video metadata: ${error}`);
    }
  }

  /**
   * Parse frame rate from string (e.g., "30000/1001")
   */
  private parseFrameRate(frameRate: string): number {
    try {
      if (frameRate.includes("/")) {
        const [numerator, denominator] = frameRate.split("/").map(Number);
        return numerator / denominator;
      }
      return parseFloat(frameRate);
    } catch {
      return 30;
    }
  }

  /**
   * Convert video to specific quality
   */
  async convertToQuality(
    inputPath: string,
    outputPath: string,
    quality: VideoQuality
  ): Promise<void> {
    const resolution = videoConfig.resolutions.find((r) => r.name === quality);
    if (!resolution) {
      throw new Error(`Unsupported quality: ${quality}`);
    }

    const args = [
      "-i",
      inputPath,
      "-c:v",
      videoConfig.ffmpeg.videoCodec,
      "-preset",
      videoConfig.ffmpeg.preset,
      "-crf",
      videoConfig.ffmpeg.crf.toString(),
      "-b:v",
      resolution.bitrate,
      "-maxrate",
      resolution.bitrate,
      "-bufsize",
      "2M",
      "-vf",
      `scale=${resolution.width}:${resolution.height}`,
      "-c:a",
      videoConfig.ffmpeg.audioCodec,
      "-b:a",
      videoConfig.ffmpeg.audioBitrate,
      "-movflags",
      "+faststart",
      "-y", // Overwrite output file
      outputPath,
    ];

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", args);

      let stderr = "";

      ffmpeg.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `FFmpeg process exited with code ${code}. Error: ${stderr}`
            )
          );
        }
      });

      ffmpeg.on("error", (error) => {
        reject(new Error(`FFmpeg process error: ${error.message}`));
      });
    });
  }

  /**
   * Generate thumbnails from video
   */
  async generateThumbnails(
    inputPath: string,
    outputDir: string,
    options: ThumbnailOptions
  ): Promise<string[]> {
    const { count, size, format, quality, timestamps } = options;
    const thumbnails: string[] = [];

    try {
      // Use provided timestamps or generate evenly spaced ones
      const thumbnailTimestamps =
        timestamps || (await this.generateTimestamps(inputPath, count));

      // Pastikan thumbnailTimestamps adalah array string sebelum diiterasi
      if (!Array.isArray(thumbnailTimestamps)) {
        throw new Error("Failed to generate timestamps");
      }

      for (let i = 0; i < thumbnailTimestamps.length; i++) {
        const timestamp = thumbnailTimestamps[i];
        const outputPath = `${outputDir}/thumbnail_${i + 1}.${format}`;

        const args = [
          "-i",
          inputPath,
          "-ss",
          timestamp,
          "-vframes",
          "1",
          "-vf",
          `scale=${size}`,
          "-q:v",
          quality.toString(),
          "-y",
          outputPath,
        ];

        await new Promise((resolve, reject) => {
          const ffmpeg = spawn("ffmpeg", args);

          let stderr = "";

          ffmpeg.stderr.on("data", (data) => {
            stderr += data.toString();
          });

          ffmpeg.on("close", (code) => {
            if (code === 0) {
              thumbnails.push(outputPath);
              resolve(outputPath);
            } else {
              reject(
                new Error(
                  `Failed to generate thumbnail at ${timestamp}. Error: ${stderr}`
                )
              );
            }
          });

          ffmpeg.on("error", reject);
        });
      }

      return thumbnails;
    } catch (error) {
      throw new Error(`Failed to generate thumbnails: ${error}`);
    }
  }

  /**
   * Generate evenly spaced timestamps for thumbnails
   */
  private async generateTimestamps(
    inputPath: string,
    count: number
  ): Promise<string[]> {
    try {
      const metadata = await this.getMetadata(inputPath);
      const interval = metadata.duration / (count + 1);
      const timestamps: string[] = [];

      for (let i = 1; i <= count; i++) {
        const timestamp = Math.floor(interval * i);
        timestamps.push(this.formatTimestamp(timestamp));
      }

      return timestamps;
    } catch (error) {
      // Fallback: generate timestamps at 10%, 50%, 90% of estimated duration
      const fallbackTimestamps: string[] = [];
      for (let i = 1; i <= count; i++) {
        const percentage = (i / (count + 1)) * 100;
        const timestamp = Math.floor((percentage / 100) * 3600); // Assume 1 hour as fallback
        fallbackTimestamps.push(this.formatTimestamp(timestamp));
      }
      return fallbackTimestamps;
    }
  }

  /**
   * Format seconds to HH:MM:SS
   */
  private formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return [
      hours.toString().padStart(2, "0"),
      minutes.toString().padStart(2, "0"),
      secs.toString().padStart(2, "0"),
    ].join(":");
  }

  /**
   * Add watermark to video
   */
  async addWatermark(
    inputPath: string,
    outputPath: string,
    watermarkPath: string,
    position: string = "bottomright",
    opacity: number = 0.3
  ): Promise<void> {
    const positionMap: Record<string, string> = {
      topleft: "10:10",
      topright: "main_w-overlay_w-10:10",
      bottomleft: "10:main_h-overlay_h-10",
      bottomright: "main_w-overlay_w-10:main_h-overlay_h-10",
      center: "(main_w-overlay_w)/2:(main_h-overlay_h)/2",
    };

    const positionValue = positionMap[position] || positionMap.bottomright;

    const args = [
      "-i",
      inputPath,
      "-i",
      watermarkPath,
      "-filter_complex",
      `[1]format=rgba,colorchannelmixer=aa=${opacity}[logo];[0][logo]overlay=${positionValue}`,
      "-c:a",
      "copy",
      "-y",
      outputPath,
    ];

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", args);

      let stderr = "";

      ffmpeg.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to add watermark. Error: ${stderr}`));
        }
      });

      ffmpeg.on("error", reject);
    });
  }

  /**
   * Extract audio from video
   */
  async extractAudio(inputPath: string, outputPath: string): Promise<void> {
    const args = ["-i", inputPath, "-q:a", "0", "-map", "a", "-y", outputPath];

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", args);

      let stderr = "";

      ffmpeg.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to extract audio. Error: ${stderr}`));
        }
      });

      ffmpeg.on("error", reject);
    });
  }

  /**
   * Check if FFmpeg is available
   */
  async checkFFmpegAvailability(): Promise<boolean> {
    try {
      await exec("ffmpeg -version");
      await exec("ffprobe -version");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get supported video formats
   */
  getSupportedFormats(): readonly string[] {
    return videoConfig.upload.allowedFormats;
  }

  /**
   * Validate video file
   */
  async validateVideoFile(
    filePath: string
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      const metadata = await this.getMetadata(filePath);

      if (metadata.duration <= 0) {
        return { isValid: false, error: "Invalid video duration" };
      }

      if (metadata.size <= 0) {
        return { isValid: false, error: "Invalid file size" };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : "Invalid video file",
      };
    }
  }
}

const videoProcessor = new VideoProcessor();
export default videoProcessor;
