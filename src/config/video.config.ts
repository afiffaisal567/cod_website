export const videoConfig = {
  // Processing Settings
  processing: {
    enabled: true,
    autoProcess: true,
    maxConcurrent: 2, // Process max 2 videos at a time
    timeout: 10 * 60 * 1000, // 10 minutes
  },

  // Video Resolutions
  resolutions: [
    {
      name: '360p',
      width: 640,
      height: 360,
      bitrate: '500k',
      enabled: true,
    },
    {
      name: '480p',
      width: 854,
      height: 480,
      bitrate: '1000k',
      enabled: true,
    },
    {
      name: '720p',
      width: 1280,
      height: 720,
      bitrate: '2500k',
      enabled: true,
    },
    {
      name: '1080p',
      width: 1920,
      height: 1080,
      bitrate: '5000k',
      enabled: true,
    },
  ],

  // FFmpeg Settings
  ffmpeg: {
    // Video Codec
    videoCodec: 'libx264',
    audioCodec: 'aac',

    // Encoding Presets
    preset: 'medium', // ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow
    crf: 23, // Constant Rate Factor (0-51, lower = better quality)

    // Audio Settings
    audioBitrate: '128k',
    audioSampleRate: 44100,
    audioChannels: 2,

    // Container Format
    format: 'mp4',

    // Additional Options
    pixelFormat: 'yuv420p',
    movflags: '+faststart', // Enable streaming
  },

  // Thumbnail Settings
  thumbnails: {
    enabled: true,
    count: 3,
    size: '320x180',
    format: 'jpg',
    quality: 80,

    // Thumbnail Times (in seconds from start)
    times: [10, 50, 90], // 10%, 50%, 90% of video duration
  },

  // Quality Settings
  quality: {
    default: '720p',
    adaptive: true, // Enable adaptive bitrate streaming
    allowedQualities: ['360p', '480p', '720p', '1080p'],
  },

  // Streaming Settings
  streaming: {
    enabled: true,
    chunkSize: 1024 * 1024, // 1MB chunks
    bufferSize: 5 * 1024 * 1024, // 5MB buffer

    // HLS Settings (for adaptive streaming)
    hls: {
      enabled: false,
      segmentDuration: 10, // seconds
      playlistType: 'vod',
    },
  },

  // Upload Settings
  upload: {
    chunkSize: 5 * 1024 * 1024, // 5MB chunks for resumable upload
    maxFileSize: 500 * 1024 * 1024, // 500MB max
    allowedFormats: ['mp4', 'webm', 'ogg', 'mov', 'avi'],
  },

  // Storage Settings
  storage: {
    keepOriginal: true,
    deleteAfterProcessing: false,
    tempDirectory: 'videos/temp',
  },

  // Watermark Settings
  watermark: {
    enabled: false,
    imagePath: './public/images/watermark.png',
    position: 'bottomright', // topleft, topright, bottomleft, bottomright, center
    opacity: 0.3,
  },

  // Queue Settings
  queue: {
    enabled: true,
    priority: {
      high: 1,
      normal: 5,
      low: 10,
    },
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
  },

  // Notifications
  notifications: {
    onComplete: true,
    onError: true,
    notifyUser: true,
    notifyAdmin: false,
  },

  // Analytics
  analytics: {
    trackViews: true,
    trackWatchTime: true,
    trackQualityChanges: true,
  },
} as const;

export type VideoConfig = typeof videoConfig;

export default videoConfig;
