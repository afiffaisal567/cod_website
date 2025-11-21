export type VideoStatus = 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type VideoQuality = '360p' | '480p' | '720p' | '1080p';

export interface VideoMetadata {
  duration: number; // in seconds
  width: number;
  height: number;
  bitrate: string;
  codec: string;
  format: string;
  size: number; // in bytes
  fps: number;
}

export interface VideoFile {
  id: string;
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimetype: string;
  status: VideoStatus;
  metadata?: VideoMetadata;
  thumbnail?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VideoQualityVersion {
  quality: VideoQuality;
  path: string;
  size: number;
  bitrate: string;
  resolution: string;
  status: VideoStatus;
}

export interface VideoProcessingJob {
  videoId: string;
  inputPath: string;
  outputPath: string;
  quality: VideoQuality;
  status: VideoStatus;
  progress: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface VideoStreamOptions {
  quality?: VideoQuality;
  start?: number;
  end?: number;
}

export interface FFmpegProgress {
  frames: number;
  currentFps: number;
  currentKbps: number;
  targetSize: number;
  timemark: string;
  percent: number;
}

export interface ThumbnailOptions {
  count: number;
  size: string;
  format: 'jpg' | 'png';
  quality: number;
  timestamps?: string[];
}

export interface VideoProcessingOptions {
  qualities?: VideoQuality[];
  generateThumbnails?: boolean;
  thumbnailOptions?: ThumbnailOptions;
  deleteOriginal?: boolean;
}

export interface VideoStreamInfo {
  path: string;
  size: number;
  mimetype: string;
  range?: {
    start: number;
    end: number;
    total: number;
  };
}
