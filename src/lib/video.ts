import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { videoConfig } from '@/config/video.config';
import { ensureDirectoryExists } from '@/utils/file.util';
import type { VideoQuality, FFmpegProgress, ThumbnailOptions } from '@/types/video.types';

/**
 * Video Metadata Response
 */
interface VideoMetadataResponse {
  duration: number;
  width: number;
  height: number;
  bitrate: string;
  codec: string;
  format: string;
  size: number;
  fps: number;
}

/**
 * FFmpeg Wrapper
 * Handles video processing operations
 */
export class VideoProcessor {
  /**
   * Get video metadata
   */
  async getMetadata(videoPath: string): Promise<VideoMetadataResponse> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find((s) => s.codec_type === 'video');

        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        resolve({
          duration: metadata.format.duration || 0,
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          bitrate: metadata.format.bit_rate?.toString() || '0',
          codec: videoStream.codec_name || 'unknown',
          format: metadata.format.format_name || 'unknown',
          size: metadata.format.size || 0,
          fps: this.calculateFPS(videoStream),
        });
      });
    });
  }

  /**
   * Calculate FPS from video stream
   */
  private calculateFPS(stream: { r_frame_rate?: string; avg_frame_rate?: string }): number {
    if (stream.r_frame_rate) {
      const [num, den] = stream.r_frame_rate.split('/').map(Number);
      return den ? num / den : 0;
    }
    return stream.avg_frame_rate ? parseFloat(stream.avg_frame_rate) : 0;
  }

  /**
   * Convert video to specific quality
   */
  async convertToQuality(
    inputPath: string,
    outputPath: string,
    quality: VideoQuality,
    onProgress?: (progress: FFmpegProgress) => void
  ): Promise<void> {
    const resolution = videoConfig.resolutions.find((r) => r.name === quality);

    if (!resolution) {
      throw new Error(`Resolution ${quality} not found`);
    }

    // Ensure output directory exists
    await ensureDirectoryExists(path.dirname(outputPath));

    return new Promise<void>((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .videoCodec(videoConfig.ffmpeg.videoCodec)
        .audioCodec(videoConfig.ffmpeg.audioCodec)
        .size(`${resolution.width}x${resolution.height}`)
        .videoBitrate(resolution.bitrate)
        .audioBitrate(videoConfig.ffmpeg.audioBitrate)
        .audioFrequency(videoConfig.ffmpeg.audioSampleRate)
        .audioChannels(videoConfig.ffmpeg.audioChannels)
        .outputOptions([
          `-preset ${videoConfig.ffmpeg.preset}`,
          `-crf ${videoConfig.ffmpeg.crf}`,
          `-pix_fmt ${videoConfig.ffmpeg.pixelFormat}`,
          `-movflags ${videoConfig.ffmpeg.movflags}`,
        ])
        .output(outputPath);

      // Track progress
      if (onProgress) {
        command.on('progress', (progress) => {
          onProgress({
            frames: progress.frames || 0,
            currentFps: progress.currentFps || 0,
            currentKbps: progress.currentKbps || 0,
            targetSize: progress.targetSize || 0,
            timemark: progress.timemark || '00:00:00',
            percent: progress.percent || 0,
          });
        });
      }

      command
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * Generate video thumbnails
   */
  async generateThumbnails(
    inputPath: string,
    outputDir: string,
    options: ThumbnailOptions = {
      count: 3,
      size: '320x180',
      format: 'jpg',
      quality: 80,
    }
  ): Promise<string[]> {
    await ensureDirectoryExists(outputDir);

    // Get video duration to calculate timestamps
    const metadata = await this.getMetadata(inputPath);
    const duration = metadata.duration;

    // Calculate timestamps if not provided
    const timestamps =
      options.timestamps || this.calculateThumbnailTimestamps(duration, options.count);

    const thumbnails: string[] = [];

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps,
          filename: `thumb_%i.${options.format}`,
          folder: outputDir,
          size: options.size,
        })
        .on('end', () => {
          // Generate thumbnail paths
          for (let i = 0; i < timestamps.length; i++) {
            thumbnails.push(path.join(outputDir, `thumb_${i + 1}.${options.format}`));
          }
          resolve(thumbnails);
        })
        .on('error', (err) => reject(err));
    });
  }

  /**
   * Calculate thumbnail timestamps
   */
  private calculateThumbnailTimestamps(duration: number, count: number): string[] {
    const timestamps: string[] = [];
    const interval = duration / (count + 1);

    for (let i = 1; i <= count; i++) {
      const seconds = Math.floor(interval * i);
      timestamps.push(this.secondsToTimestamp(seconds));
    }

    return timestamps;
  }

  /**
   * Convert seconds to FFmpeg timestamp format
   */
  private secondsToTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
      secs
    ).padStart(2, '0')}`;
  }

  /**
   * Extract audio from video
   */
  async extractAudio(inputPath: string, outputPath: string): Promise<void> {
    await ensureDirectoryExists(path.dirname(outputPath));

    return new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .noVideo()
        .audioCodec(videoConfig.ffmpeg.audioCodec)
        .audioBitrate(videoConfig.ffmpeg.audioBitrate)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * Merge video and audio
   */
  async mergeVideoAudio(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
    await ensureDirectoryExists(path.dirname(outputPath));

    return new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .videoCodec('copy')
        .audioCodec('copy')
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * Create video preview (short clip)
   */
  async createPreview(inputPath: string, outputPath: string, duration: number = 30): Promise<void> {
    await ensureDirectoryExists(path.dirname(outputPath));

    return new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(0)
        .setDuration(duration)
        .videoCodec(videoConfig.ffmpeg.videoCodec)
        .audioCodec(videoConfig.ffmpeg.audioCodec)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }
}

export const videoProcessor = new VideoProcessor();
export default videoProcessor;
