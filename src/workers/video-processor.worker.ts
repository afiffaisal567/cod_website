import { Queue, Worker, Job } from 'bullmq';
import { videoConfig } from '@/config/video.config';
import videoService from '@/services/video.service';
import { logInfo, logError } from '@/utils/logger.util';
import type { VideoQuality } from '@/types/video.types';

/**
 * Video Processing Job Data
 */
interface VideoProcessingJobData {
  videoId: string;
  inputPath: string;
  options?: {
    qualities?: VideoQuality[];
    generateThumbnails?: boolean;
    deleteOriginal?: boolean;
  };
}

/**
 * Job Status Response
 */
interface JobStatusResponse {
  state: string;
  progress: number;
  data?: unknown;
  error?: string;
}

/**
 * Create Video Processing Queue
 */
export const videoProcessingQueue = new Queue<VideoProcessingJobData>('video-processing', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  defaultJobOptions: {
    attempts: videoConfig.queue.maxRetries,
    backoff: {
      type: 'exponential',
      delay: videoConfig.queue.retryDelay,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 100,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

/**
 * Video Processing Worker
 */
export const videoProcessingWorker = new Worker<VideoProcessingJobData>(
  'video-processing',
  async (job: Job<VideoProcessingJobData>) => {
    const { videoId, inputPath, options } = job.data;

    logInfo(`Processing video ${videoId}`, { videoId, inputPath });

    try {
      // Update progress
      await job.updateProgress(0);

      // Process video with proper options
      await videoService.processVideo(videoId, inputPath, {
        qualities: options?.qualities,
        generateThumbnails: options?.generateThumbnails,
        deleteOriginal: options?.deleteOriginal,
      });

      // Update progress
      await job.updateProgress(100);

      logInfo(`Video processed successfully`, { videoId });

      return { success: true, videoId };
    } catch (error) {
      logError(`Video processing failed`, { videoId, error });
      throw error;
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    concurrency: videoConfig.processing.maxConcurrent,
  }
);

/**
 * Add video to processing queue
 */
export async function queueVideoProcessing(
  videoId: string,
  inputPath: string,
  options?: {
    qualities?: VideoQuality[];
    generateThumbnails?: boolean;
    deleteOriginal?: boolean;
  }
): Promise<Job<VideoProcessingJobData>> {
  return videoProcessingQueue.add(
    'process-video',
    {
      videoId,
      inputPath,
      options,
    },
    {
      priority: videoConfig.queue.priority.normal,
    }
  );
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const job = await videoProcessingQueue.getJob(jobId);

  if (!job) {
    throw new Error('Job not found');
  }

  const state = await job.getState();
  const progress = (job.progress as number) || 0;

  return {
    state,
    progress,
    data: job.returnvalue,
    error: job.failedReason,
  };
}

// Worker event handlers
videoProcessingWorker.on('completed', (job) => {
  logInfo(`Video processing job completed`, { jobId: job.id });
});

videoProcessingWorker.on('failed', (job, err) => {
  logError(`Video processing job failed`, { jobId: job?.id, error: err });
});

videoProcessingWorker.on('progress', (job, progress) => {
  logInfo(`Video processing progress`, { jobId: job.id, progress });
});

// Named export instead of anonymous default
const videoProcessorModule = {
  queue: videoProcessingQueue,
  worker: videoProcessingWorker,
  queueVideoProcessing,
  getJobStatus,
};

export default videoProcessorModule;
