import path from 'path';
import fs from 'fs/promises';
import type { Stats } from 'fs';
import { UPLOAD_LIMITS } from '@/lib/constants';

/**
 * Get file extension
 */
export function getFileExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

/**
 * Get filename without extension
 */
export function getFilenameWithoutExtension(filename: string): string {
  return path.basename(filename, path.extname(filename));
}

/**
 * Generate unique filename
 */
export function generateUniqueFilename(originalFilename: string): string {
  const extension = getFileExtension(originalFilename);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${timestamp}-${random}${extension}`;
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Check if file is video
 */
export function isVideoFile(mimetype: string): boolean {
  return UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES.some((type) => type === mimetype);
}

/**
 * Check if file is image
 */
export function isImageFile(mimetype: string): boolean {
  return UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES.some((type) => type === mimetype);
}

/**
 * Check if file is document
 */
export function isDocumentFile(mimetype: string): boolean {
  return UPLOAD_LIMITS.ALLOWED_DOCUMENT_TYPES.some((type) => type === mimetype);
}

/**
 * Validate file size
 */
export function validateFileSize(size: number, maxSize: number): boolean {
  return size <= maxSize;
}

/**
 * Check if directory exists, create if not
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Delete file
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error('Error deleting file:', error);
  }
}

/**
 * Delete directory recursively
 */
export async function deleteDirectory(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    console.error('Error deleting directory:', error);
  }
}

/**
 * Move file
 */
export async function moveFile(sourcePath: string, destinationPath: string): Promise<void> {
  await fs.rename(sourcePath, destinationPath);
}

/**
 * Copy file
 */
export async function copyFile(sourcePath: string, destinationPath: string): Promise<void> {
  await fs.copyFile(sourcePath, destinationPath);
}

/**
 * Read file as buffer
 */
export async function readFileAsBuffer(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}

/**
 * Write buffer to file
 */
export async function writeBufferToFile(buffer: Buffer, filePath: string): Promise<void> {
  await ensureDirectoryExists(path.dirname(filePath));
  await fs.writeFile(filePath, buffer);
}

/**
 * Get file stats
 */
export async function getFileStats(filePath: string): Promise<Stats> {
  return fs.stat(filePath);
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
