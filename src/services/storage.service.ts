import { storage } from '@/lib/storage';
import { storageConfig } from '@/config/storage.config';
import path from 'path';
import fs from 'fs/promises';

interface DirectoryStats {
  size: number;
  count: number;
}

interface StorageStats {
  totalSize: number;
  totalFiles: number;
  byType: {
    videos: DirectoryStats;
    images: DirectoryStats;
    documents: DirectoryStats;
  };
}

interface CleanupResult {
  deletedCount: number;
  freedSpace: number;
}

/**
 * Storage Service
 * Handles storage management operations
 */
export class StorageService {
  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    const stats: StorageStats = {
      totalSize: 0,
      totalFiles: 0,
      byType: {
        videos: { size: 0, count: 0 },
        images: { size: 0, count: 0 },
        documents: { size: 0, count: 0 },
      },
    };

    // Calculate stats for each directory
    for (const type of ['videos', 'images', 'documents'] as const) {
      const dirPath = path.join(storageConfig.local.basePath, type);
      const dirStats = await this.getDirectoryStats(dirPath);

      stats.byType[type] = dirStats;
      stats.totalSize += dirStats.size;
      stats.totalFiles += dirStats.count;
    }

    return stats;
  }

  /**
   * Get directory statistics
   */
  private async getDirectoryStats(dirPath: string): Promise<DirectoryStats> {
    let size = 0;
    let count = 0;

    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true });

      for (const file of files) {
        const filePath = path.join(dirPath, file.name);

        if (file.isDirectory()) {
          const subStats = await this.getDirectoryStats(filePath);
          size += subStats.size;
          count += subStats.count;
        } else {
          const stats = await fs.stat(filePath);
          size += stats.size;
          count++;
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }

    return { size, count };
  }

  /**
   * Clean up temp files
   */
  async cleanupTempFiles(): Promise<CleanupResult> {
    const tempDir = path.join(storageConfig.local.basePath, 'videos', 'temp');
    const maxAge = storageConfig.cleanup.tempFileMaxAge;
    const now = Date.now();

    let deletedCount = 0;
    let freedSpace = 0;

    try {
      const files = await fs.readdir(tempDir);

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);

        // Check if file is older than maxAge
        const fileAge = now - stats.mtimeMs;
        if (fileAge > maxAge) {
          freedSpace += stats.size;
          await storage.delete(path.join('videos', 'temp', file));
          deletedCount++;
        }
      }
    } catch (error) {
      console.error('Error cleaning temp files:', error);
    }

    return { deletedCount, freedSpace };
  }

  /**
   * Move file between directories
   */
  async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    await storage.move(sourcePath, destinationPath);
  }

  /**
   * Copy file
   */
  async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
    await storage.copy(sourcePath, destinationPath);
  }

  /**
   * Ensure all required directories exist
   */
  async initializeStorage(): Promise<void> {
    const basePath = storageConfig.local.basePath;
    const directories = [
      'videos/originals',
      'videos/processed/360p',
      'videos/processed/480p',
      'videos/processed/720p',
      'videos/processed/1080p',
      'videos/thumbnails',
      'videos/temp',
      'images/profiles',
      'images/courses',
      'images/certificates',
      'documents/pdfs',
      'documents/presentations',
      'documents/others',
    ];

    for (const dir of directories) {
      const dirPath = path.join(basePath, dir);
      await fs.mkdir(dirPath, { recursive: true });
    }

    console.log('✅ Storage directories initialized');
  }

  /**
   * Get public URL for file
   */
  getPublicUrl(filePath: string): string {
    return storage.getUrl(filePath);
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    return storage.exists(filePath);
  }

  /**
   * Delete file
   */
  async deleteFile(filePath: string): Promise<void> {
    await storage.delete(filePath);
  }

  /**
   * Backup file
   */
  async backupFile(filePath: string): Promise<string> {
    const backupPath = `${filePath}.backup`;
    await storage.copy(filePath, backupPath);
    return backupPath;
  }
}

const storageService = new StorageService();
export default storageService;
