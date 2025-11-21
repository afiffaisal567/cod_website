import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis-upstash";
import { logInfo, logError } from "@/utils/logger.util";
import type { Prisma } from "@prisma/client";

/**
 * Event Types
 */
export type AnalyticsEventType =
  | "page_view"
  | "course_view"
  | "video_watch"
  | "video_complete"
  | "search"
  | "enrollment"
  | "purchase"
  | "certificate_download"
  | "course_complete"
  | "material_access"
  | "comment_create"
  | "review_create"
  | "wishlist_add"
  | "custom";

/**
 * Analytics Event Data
 */
interface AnalyticsEvent {
  userId?: string;
  eventType: AnalyticsEventType;
  eventData: Record<string, unknown>;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  timestamp: Date;
}

/**
 * Course Analytics
 */
interface CourseAnalytics {
  courseId: string;
  views: number;
  uniqueVisitors: number;
  enrollments: number;
  completions: number;
  averageWatchTime: number;
  engagementRate: number;
}

/**
 * User Behavior
 */
interface UserBehavior {
  userId: string;
  coursesViewed: string[];
  coursesEnrolled: string[];
  totalWatchTime: number;
  favoriteCategories: string[];
  averageSessionDuration: number;
  lastActive: Date;
}

/**
 * Analytics Service
 * Handles event tracking and analytics processing
 */
export class AnalyticsService {
  /**
   * Track event
   */
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // Store in Redis for real-time analytics (TTL 7 days)
      const eventKey = `analytics:event:${Date.now()}:${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      await redis.setex(eventKey, 7 * 24 * 60 * 60, JSON.stringify(event));

      // Store in database for long-term analytics
      await prisma.activityLog.create({
        data: {
          user_id: event.userId || "anonymous",
          action: event.eventType,
          entity_type: this.extractEntityType(event.eventData),
          entity_id: this.extractEntityId(event.eventData),
          metadata: event.eventData as Prisma.JsonObject,
          ip_address: event.ipAddress,
          user_agent: event.userAgent,
        },
      });

      // Update specific counters based on event type
      await this.updateCounters(event);

      logInfo(`Event tracked: ${event.eventType}`, {
        userId: event.userId,
        eventData: event.eventData,
      });
    } catch (error) {
      logError("Failed to track event", error);
      throw error;
    }
  }

  /**
   * Track page view
   */
  async trackPageView(
    userId: string | undefined,
    url: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.trackEvent({
      userId,
      eventType: "page_view",
      eventData: {
        url,
        ...metadata,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Track course view
   */
  async trackCourseView(
    userId: string | undefined,
    courseId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.trackEvent({
      userId,
      eventType: "course_view",
      eventData: {
        courseId,
        ...metadata,
      },
      timestamp: new Date(),
    });

    // Increment course view count
    await prisma.course.update({
      where: { id: courseId },
      data: { total_views: { increment: 1 } },
    });

    // Track unique visitor in Redis
    if (userId) {
      const uniqueKey = `analytics:course:${courseId}:visitors`;
      await redis.sadd(uniqueKey, userId);
    }
  }

  /**
   * Track video watch
   */
  async trackVideoWatch(
    userId: string,
    videoId: string,
    materialId: string,
    watchDuration: number,
    totalDuration: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const watchPercentage = (watchDuration / totalDuration) * 100;

    await this.trackEvent({
      userId,
      eventType: "video_watch",
      eventData: {
        videoId,
        materialId,
        watchDuration,
        totalDuration,
        watchPercentage,
        ...metadata,
      },
      timestamp: new Date(),
    });

    // Track completion if >= 90%
    if (watchPercentage >= 90) {
      await this.trackEvent({
        userId,
        eventType: "video_complete",
        eventData: {
          videoId,
          materialId,
          watchDuration,
          totalDuration,
        },
        timestamp: new Date(),
      });
    }

    // Update user total watch time in Redis
    const watchTimeKey = `analytics:user:${userId}:watchtime`;
    await redis.incrby(watchTimeKey, Math.floor(watchDuration));
  }

  /**
   * Track search
   */
  async trackSearch(
    userId: string | undefined,
    query: string,
    resultsCount: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.trackEvent({
      userId,
      eventType: "search",
      eventData: {
        query,
        resultsCount,
        ...metadata,
      },
      timestamp: new Date(),
    });

    // Store popular searches in Redis
    const searchKey = `analytics:searches:${query.toLowerCase()}`;
    await redis.incr(searchKey);
  }

  /**
   * Track enrollment
   */
  async trackEnrollment(
    userId: string,
    courseId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.trackEvent({
      userId,
      eventType: "enrollment",
      eventData: {
        courseId,
        ...metadata,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Get course analytics
   */
  async getCourseAnalytics(
    courseId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<CourseAnalytics> {
    const dateFilter: Prisma.ActivityLogWhereInput = {
      entity_type: "course",
      entity_id: courseId,
    };

    if (dateFrom || dateTo) {
      dateFilter.created_at = {};
      if (dateFrom) dateFilter.created_at.gte = dateFrom;
      if (dateTo) dateFilter.created_at.lte = dateTo;
    }

    const [views, enrollments, completions, watchTimeData, course] =
      await Promise.all([
        // Total views
        prisma.activityLog.count({
          where: {
            ...dateFilter,
            action: "course_view",
          },
        }),

        // Enrollments
        prisma.enrollment.count({
          where: {
            course_id: courseId,
            ...(dateFrom || dateTo
              ? {
                  created_at: {
                    ...(dateFrom ? { gte: dateFrom } : {}),
                    ...(dateTo ? { lte: dateTo } : {}),
                  },
                }
              : {}),
          },
        }),

        // Completions
        prisma.enrollment.count({
          where: {
            course_id: courseId,
            status: "COMPLETED",
            ...(dateFrom || dateTo
              ? {
                  completed_at: {
                    ...(dateFrom ? { gte: dateFrom } : {}),
                    ...(dateTo ? { lte: dateTo } : {}),
                  },
                }
              : {}),
          },
        }),

        // Average watch time
        prisma.activityLog.findMany({
          where: {
            entity_type: "material",
            action: "video_watch",
            metadata: {
              path: ["courseId"],
              equals: courseId,
            },
          },
          select: {
            metadata: true,
          },
        }),

        // Course data
        prisma.course.findUnique({
          where: { id: courseId },
          select: {
            total_views: true,
            total_students: true,
          },
        }),
      ]);

    // Calculate unique visitors from Redis
    const uniqueVisitorsKey = `analytics:course:${courseId}:visitors`;
    const uniqueVisitors = await redis.scard(uniqueVisitorsKey);

    // Calculate average watch time
    let totalWatchTime = 0;
    watchTimeData.forEach((log) => {
      const metadata = log.metadata as { watchDuration?: number };
      if (metadata.watchDuration) {
        totalWatchTime += metadata.watchDuration;
      }
    });
    const averageWatchTime =
      watchTimeData.length > 0 ? totalWatchTime / watchTimeData.length : 0;

    // Calculate engagement rate
    const engagementRate = views > 0 ? (enrollments / views) * 100 : 0;

    return {
      courseId,
      views: course?.total_views || views,
      uniqueVisitors: uniqueVisitors || 0,
      enrollments,
      completions,
      averageWatchTime,
      engagementRate,
    };
  }

  /**
   * Get user behavior
   */
  async getUserBehavior(userId: string): Promise<UserBehavior> {
    const [coursesViewed, enrollments, watchTimeStr, activityLogs] =
      await Promise.all([
        // Courses viewed
        prisma.activityLog.findMany({
          where: {
            user_id: userId,
            action: "course_view",
          },
          select: {
            entity_id: true,
          },
          distinct: ["entity_id"],
        }),

        // Courses enrolled
        prisma.enrollment.findMany({
          where: { user_id: userId },
          select: {
            course_id: true,
          },
        }),

        // Total watch time from Redis
        redis.get(`analytics:user:${userId}:watchtime`),

        // Recent activity
        prisma.activityLog.findMany({
          where: { user_id: userId },
          orderBy: { created_at: "desc" },
          take: 100,
        }),
      ]);

    const totalWatchTime = watchTimeStr ? parseInt(watchTimeStr as string) : 0;

    // Get favorite categories
    const categoryCounts = new Map<string, number>();
    for (const log of activityLogs) {
      if (log.action === "course_view" && log.entity_id) {
        const course = await prisma.course.findUnique({
          where: { id: log.entity_id },
          select: { category_id: true },
        });
        if (course) {
          categoryCounts.set(
            course.category_id,
            (categoryCounts.get(course.category_id) || 0) + 1
          );
        }
      }
    }

    const favoriteCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([categoryId]) => categoryId);

    // Calculate average session duration
    const sessions = this.groupIntoSessions(activityLogs);
    const totalSessionDuration = sessions.reduce(
      (sum, session) => sum + session.duration,
      0
    );
    const averageSessionDuration =
      sessions.length > 0 ? totalSessionDuration / sessions.length : 0;

    return {
      userId,
      coursesViewed: coursesViewed.map((log) => log.entity_id!).filter(Boolean),
      coursesEnrolled: enrollments.map((e) => e.course_id),
      totalWatchTime,
      favoriteCategories,
      averageSessionDuration,
      lastActive: activityLogs[0]?.created_at || new Date(),
    };
  }

  /**
   * Get popular searches
   */
  async getPopularSearches(
    limit: number = 10
  ): Promise<Array<{ query: string; count: number }>> {
    const searchKeys = await redis.keys("analytics:searches:*");
    const searches: Array<{ query: string; count: number }> = [];

    for (const key of searchKeys) {
      const count = await redis.get(key);
      const query = key.replace("analytics:searches:", "");
      searches.push({
        query,
        count: parseInt(count as string) || 0,
      });
    }

    return searches.sort((a, b) => b.count - a.count).slice(0, limit);
  }

  /**
   * Get trending courses
   */
  async getTrendingCourses(
    limit: number = 10,
    timeWindow: number = 7 * 24 * 60 * 60 * 1000 // 7 days
  ): Promise<Array<{ courseId: string; score: number }>> {
    const since = new Date(Date.now() - timeWindow);

    const recentViews = await prisma.activityLog.groupBy({
      by: ["entity_id"],
      where: {
        action: "course_view",
        entity_type: "course",
        created_at: { gte: since },
      },
      _count: {
        _all: true,
      },
      orderBy: {
        _count: {
          entity_id: "desc",
        },
      },
      take: limit,
    });

    return recentViews.map((view) => ({
      courseId: view.entity_id!,
      score: view._count._all,
    }));
  }

  /**
   * Update counters based on event type
   */
  private async updateCounters(event: AnalyticsEvent): Promise<void> {
    switch (event.eventType) {
      case "course_view":
        const courseId = event.eventData.courseId as string;
        if (courseId) {
          await redis.incr(`analytics:course:${courseId}:views`);
        }
        break;

      case "video_watch":
        const videoId = event.eventData.videoId as string;
        if (videoId) {
          await redis.incr(`analytics:video:${videoId}:watches`);
        }
        break;

      case "search":
        const query = event.eventData.query as string;
        if (query) {
          await redis.incr(`analytics:search:${query.toLowerCase()}`);
        }
        break;
    }
  }

  /**
   * Extract entity type from event data
   */
  private extractEntityType(
    eventData: Record<string, unknown>
  ): string | undefined {
    if (eventData.courseId) return "course";
    if (eventData.materialId) return "material";
    if (eventData.videoId) return "video";
    return undefined;
  }

  /**
   * Extract entity ID from event data
   */
  private extractEntityId(
    eventData: Record<string, unknown>
  ): string | undefined {
    return (eventData.courseId || eventData.materialId || eventData.videoId) as
      | string
      | undefined;
  }

  /**
   * Group activity logs into sessions
   */
  private groupIntoSessions(
    logs: Array<{ created_at: Date }>
  ): Array<{ duration: number }> {
    if (logs.length === 0) return [];

    const sessions: Array<{ duration: number }> = [];
    const sessionGap = 30 * 60 * 1000; // 30 minutes

    let sessionStart = logs[0].created_at.getTime();
    let lastActivity = sessionStart;

    for (let i = 1; i < logs.length; i++) {
      const currentTime = logs[i].created_at.getTime();
      const gap = lastActivity - currentTime;

      if (gap > sessionGap) {
        // End current session
        sessions.push({
          duration: lastActivity - sessionStart,
        });
        // Start new session
        sessionStart = currentTime;
      }

      lastActivity = currentTime;
    }

    // Add final session
    sessions.push({
      duration: lastActivity - sessionStart,
    });

    return sessions;
  }
}

const analyticsService = new AnalyticsService();
export default analyticsService;
