import { videoStreaming } from '@/lib/streaming';
import { AppError } from '@/utils/error.util';
import { HTTP_STATUS } from '@/lib/constants';
import type { VideoQuality, VideoStreamInfo } from '@/types/video.types';

/**
 * Streaming Service
 * Handles video streaming operations
 */
export class StreamingService {
  /**
   * Stream video with quality selection
   */
  async streamVideo(
    videoId: string,
    quality?: VideoQuality,
    range?: string
  ): Promise<VideoStreamInfo> {
    // Get video path
    const videoPath = videoStreaming.getVideoPath(videoId, quality);

    // Get stream
    try {
      return await videoStreaming.getVideoStream(videoPath, range);
    } catch {
      throw new AppError('Video not found or cannot be streamed', HTTP_STATUS.NOT_FOUND);
    }
  }

  /**
   * Get available qualities for video
   */
  async getAvailableQualities(videoId: string): Promise<VideoQuality[]> {
    return videoStreaming.getAvailableQualities(videoId);
  }

  /**
   * Get optimal quality based on connection speed
   */
  async getOptimalQuality(videoId: string, connectionSpeed?: number): Promise<VideoQuality> {
    const available = await this.getAvailableQualities(videoId);

    if (available.length === 0) {
      throw new AppError('No qualities available', HTTP_STATUS.NOT_FOUND);
    }

    // If no connection speed provided, return highest quality
    if (!connectionSpeed) {
      return available[available.length - 1];
    }

    // Map connection speed to quality
    // connectionSpeed in Mbps
    if (connectionSpeed >= 5) return '1080p';
    if (connectionSpeed >= 2.5) return '720p';
    if (connectionSpeed >= 1) return '480p';
    return '360p';
  }

  /**
   * Get stream response info
   */
  getStreamResponse(info: VideoStreamInfo): {
    headers: Record<string, string | number>;
    statusCode: number;
  } {
    return {
      headers: videoStreaming.getStreamHeaders(info),
      statusCode: videoStreaming.getStatusCode(!!info.range),
    };
  }
}

const streamingService = new StreamingService();
export default streamingService;
