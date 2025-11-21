import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

// Create Redis connection for BullMQ
export const redisConnection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  }
);

// Certificate Queue
export const certificateQueue = new Queue("certificate", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 100,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

// Export all queues
export const queues = {
  certificate: certificateQueue,
};

export type QueueName = keyof typeof queues;
