import fs from "fs/promises";
import path from "path";
import { storageConfig } from "@/config/storage.config";
import {
  ensureDirectoryExists,
  deleteFile,
  moveFile,
  copyFile,
  fileExists,
} from "@/utils/file.util";

/**
 * Storage Interface
 */
export interface IStorage {
  save(filePath: string, buffer: Buffer): Promise<string>;
  get(filePath: string): Promise<Buffer>;
  delete(filePath: string): Promise<void>;
  exists(filePath: string): Promise<boolean>;
  move(sourcePath: string, destinationPath: string): Promise<void>;
  copy(sourcePath: string, destinationPath: string): Promise<void>;
  getUrl(filePath: string): string;
}

/**
 * Local Storage Implementation
 */
export class LocalStorage implements IStorage {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || storageConfig.local.basePath;
  }

  /**
   * Save file to local storage
   */
  async save(filePath: string, buffer: Buffer): Promise<string> {
    const fullPath = path.join(this.basePath, filePath);
    await ensureDirectoryExists(path.dirname(fullPath));
    await fs.writeFile(fullPath, buffer);
    return filePath;
  }

  /**
   * Get file from local storage
   */
  async get(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.basePath, filePath);
    return fs.readFile(fullPath);
  }

  /**
   * Delete file from local storage
   */
  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    await deleteFile(fullPath);
  }

  /**
   * Check if file exists
   */
  async exists(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, filePath);
    return fileExists(fullPath);
  }

  /**
   * Move file
   */
  async move(sourcePath: string, destinationPath: string): Promise<void> {
    const fullSourcePath = path.join(this.basePath, sourcePath);
    const fullDestPath = path.join(this.basePath, destinationPath);
    await ensureDirectoryExists(path.dirname(fullDestPath));
    await moveFile(fullSourcePath, fullDestPath);
  }

  /**
   * Copy file
   */
  async copy(sourcePath: string, destinationPath: string): Promise<void> {
    const fullSourcePath = path.join(this.basePath, sourcePath);
    const fullDestPath = path.join(this.basePath, destinationPath);
    await ensureDirectoryExists(path.dirname(fullDestPath));
    await copyFile(fullSourcePath, fullDestPath);
  }

  /**
   * Get public URL for file
   */
  getUrl(filePath: string): string {
    return `${storageConfig.local.publicPath}/${filePath}`;
  }

  /**
   * Get full path
   */
  getFullPath(filePath: string): string {
    return path.join(this.basePath, filePath);
  }
}

/**
 * S3 Storage Implementation (Placeholder)
 */
export class S3Storage implements IStorage {
  // TODO: Implement S3 storage when needed

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async save(filePath: string, buffer: Buffer): Promise<string> {
    throw new Error("S3 Storage not implemented yet");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async get(filePath: string): Promise<Buffer> {
    throw new Error("S3 Storage not implemented yet");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async delete(filePath: string): Promise<void> {
    throw new Error("S3 Storage not implemented yet");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async exists(filePath: string): Promise<boolean> {
    throw new Error("S3 Storage not implemented yet");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async move(sourcePath: string, destinationPath: string): Promise<void> {
    throw new Error("S3 Storage not implemented yet");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async copy(sourcePath: string, destinationPath: string): Promise<void> {
    throw new Error("S3 Storage not implemented yet");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getUrl(filePath: string): string {
    throw new Error("S3 Storage not implemented yet");
  }
}

/**
 * Storage Factory
 */
export class StorageFactory {
  private static instance: IStorage;

  static getInstance(): IStorage {
    if (!this.instance) {
      switch (storageConfig.type) {
        case "s3":
          this.instance = new S3Storage();
          break;
        case "local":
        default:
          this.instance = new LocalStorage();
          break;
      }
    }
    return this.instance;
  }
}

/**
 * Default storage instance
 */
export const storage = StorageFactory.getInstance();

export default storage;
