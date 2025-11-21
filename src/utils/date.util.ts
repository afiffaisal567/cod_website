import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';
import { DATE_FORMATS } from '@/lib/constants';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

/**
 * Format date to display format
 */
export function formatDate(date: Date | string, format: string = DATE_FORMATS.DISPLAY): string {
  return dayjs(date).format(format);
}

/**
 * Format date with time
 */
export function formatDateTime(date: Date | string): string {
  return dayjs(date).format(DATE_FORMATS.DISPLAY_WITH_TIME);
}

/**
 * Get relative time (e.g., "2 hours ago")
 */
export function getRelativeTime(date: Date | string): string {
  return dayjs(date).fromNow();
}

/**
 * Check if date is in the past
 */
export function isPast(date: Date | string): boolean {
  return dayjs(date).isBefore(dayjs());
}

/**
 * Check if date is in the future
 */
export function isFuture(date: Date | string): boolean {
  return dayjs(date).isAfter(dayjs());
}

/**
 * Check if date is today
 */
export function isToday(date: Date | string): boolean {
  return dayjs(date).isSame(dayjs(), 'day');
}

/**
 * Add days to date
 */
export function addDays(date: Date | string, days: number): Date {
  return dayjs(date).add(days, 'day').toDate();
}

/**
 * Subtract days from date
 */
export function subtractDays(date: Date | string, days: number): Date {
  return dayjs(date).subtract(days, 'day').toDate();
}

/**
 * Get start of day
 */
export function startOfDay(date: Date | string): Date {
  return dayjs(date).startOf('day').toDate();
}

/**
 * Get end of day
 */
export function endOfDay(date: Date | string): Date {
  return dayjs(date).endOf('day').toDate();
}

/**
 * Get difference in days
 */
export function diffInDays(date1: Date | string, date2: Date | string): number {
  return dayjs(date1).diff(dayjs(date2), 'day');
}

/**
 * Get difference in hours
 */
export function diffInHours(date1: Date | string, date2: Date | string): number {
  return dayjs(date1).diff(dayjs(date2), 'hour');
}

/**
 * Get difference in minutes
 */
export function diffInMinutes(date1: Date | string, date2: Date | string): number {
  return dayjs(date1).diff(dayjs(date2), 'minute');
}

/**
 * Parse ISO string to Date
 */
export function parseISO(dateString: string): Date {
  return dayjs(dateString).toDate();
}

/**
 * Format to ISO string
 */
export function toISOString(date: Date | string): string {
  return dayjs(date).toISOString();
}

/**
 * Get current timestamp
 */
export function getCurrentTimestamp(): Date {
  return new Date();
}

/**
 * Convert minutes to hours and minutes
 */
export function minutesToHoursMinutes(minutes: number): { hours: number; minutes: number } {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return { hours, minutes: mins };
}

/**
 * Format duration (e.g., "2h 30m")
 */
export function formatDuration(minutes: number): string {
  const { hours, minutes: mins } = minutesToHoursMinutes(minutes);

  if (hours === 0) {
    return `${mins}m`;
  }

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
}

/**
 * Format seconds to time string (e.g., "1:30:45")
 */
export function formatSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/**
 * Get age from date of birth
 */
export function getAge(dateOfBirth: Date | string): number {
  return dayjs().diff(dayjs(dateOfBirth), 'year');
}

/**
 * Check if date is valid
 */
export function isValidDate(date: string | number | Date | null | undefined): boolean {
  if (date === null || date === undefined) return false;
  return dayjs(date).isValid();
}

/**
 * Add hours to date
 */
export function addHours(date: Date | string, hours: number): Date {
  return dayjs(date).add(hours, 'hour').toDate();
}

/**
 * Check if date is expired
 */
export function isExpired(date: Date | string): boolean {
  return dayjs(date).isBefore(dayjs());
}
