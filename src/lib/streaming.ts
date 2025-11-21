import fs from 'fs';
import path from 'path';
import { storageConfig } from '@/config/storage.config';
import type { VideoStreamInfo, VideoQuality } from '@/types/video.types';

/**
 * Video Stream Response
 */
interface VideoStreamResponse extends VideoStreamInfo {
  stream: fs.ReadStream;
}

/**
 * Video Streaming
 * Handles video streaming with range request support
 */
export class VideoStreaming {
  /**
   * Get video stream with range support
   */
  async getVideoStream(videoPath: string, range?: string): Promise<VideoStreamResponse> {
    const fullPath = path.join(storageConfig.local.basePath, videoPath);

    // Get file stats
    const stat = await fs.promises.stat(fullPath);
    const fileSize = stat.size;

    // Parse range header
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      // Create read stream with range
      const stream = fs.createReadStream(fullPath, { start, end });

      return {
        path: videoPath,
        size: chunkSize,
        mimetype: 'video/mp4',
        range: {
          start,
          end,
          total: fileSize,
        },
        stream,
      };
    }

    // No range, stream entire file
    const stream = fs.createReadStream(fullPath);

    return {
      path: videoPath,
      size: fileSize,
      mimetype: 'video/mp4',
      stream,
    };
  }

  /**
   * Get available qualities for video
   */
  async getAvailableQualities(videoId: string): Promise<VideoQuality[]> {
    const qualities: VideoQuality[] = [];
    const processedDir = path.join(storageConfig.local.basePath, 'videos', 'processed');

    // Check each quality directory
    for (const quality of ['360p', '480p', '720p', '1080p'] as VideoQuality[]) {
      const qualityPath = path.join(processedDir, quality, `${videoId}.mp4`);

      try {
        await fs.promises.access(qualityPath);
        qualities.push(quality);
      } catch {
        // Quality not available
      }
    }

    return qualities;
  }

  /**
   * Get video path for specific quality
   */
  getVideoPath(videoId: string, quality?: VideoQuality): string {
    if (quality) {
      return path.join('videos', 'processed', quality, `${videoId}.mp4`);
    }
    return path.join('videos', 'originals', `${videoId}.mp4`);
  }

  /**
   * Calculate buffer size based on bitrate
   */
  calculateBufferSize(bitrate: string): number {
    // Parse bitrate (e.g., "2500k" -> 2500000)
    const bitrateNum = parseInt(bitrate.replace('k', '000'));

    // Buffer size = 5 seconds of video
    return Math.floor((bitrateNum / 8) * 5);
  }

  /**
   * Get stream headers for range request
   */
  getStreamHeaders(info: VideoStreamInfo): Record<string, string | number> {
    const headers: Record<string, string | number> = {
      'Content-Type': info.mimetype,
      'Accept-Ranges': 'bytes',
    };

    if (info.range) {
      headers['Content-Range'] = `bytes ${info.range.start}-${info.range.end}/${info.range.total}`;
      headers['Content-Length'] = info.size.toString();
    } else {
      headers['Content-Length'] = info.size.toString();
    }

    return headers;
  }

  /**
   * Get HTTP status code for response
   */
  getStatusCode(hasRange: boolean): number {
    return hasRange ? 206 : 200; // 206 = Partial Content
  }
}

export const videoStreaming = new VideoStreaming();
export default videoStreaming;
