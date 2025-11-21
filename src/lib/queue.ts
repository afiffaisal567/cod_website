import { Queue, Worker, QueueEvents } from "bullmq";
import { redis } from "./redis-upstash";

// Email Queue
export const emailQueue = new Queue("email-queue", {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
});

// For Upstash Redis (REST API), we'll use a simple in-memory queue as fallback
class SimpleQueue {
  private queue: Array<{ name: string; data: any; options?: any }> = [];
  private processing = false;

  async add(name: string, data: any, options?: any) {
    this.queue.push({ name, data, options });
    if (!this.processing) {
      this.processQueue();
    }
  }

  private async processQueue() {
    this.processing = true;
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (job) {
        // Process job here
        console.log("Processing job:", job.name);
        // Add your job processing logic
      }
    }
    this.processing = false;
  }
}

// Use simple queue for Upstash (which uses REST API, not Redis protocol)
export const upstashEmailQueue = new SimpleQueue();

// Export the queue to use based on environment
export const activeEmailQueue = process.env.UPSTASH_REDIS_REST_URL
  ? upstashEmailQueue
  : emailQueue;
