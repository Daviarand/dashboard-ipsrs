import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LOGIN_EMAIL_DOMAIN } from '@/lib/constants';

/**
 * Merge Tailwind CSS class names, resolving conflicts.
 * Combines clsx (conditional classes) with tailwind-merge (conflict resolution).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Convert a username to a full email address using the app's email domain.
 *
 * @example usernameToEmail("admin") → "admin@ipsrs.local"
 */
export function usernameToEmail(username: string): string {
  return `${username}@${LOGIN_EMAIL_DOMAIN}`;
}

/**
 * Extract the username portion from an email address.
 *
 * @example emailToUsername("admin@ipsrs.local") → "admin"
 */
export function emailToUsername(email: string): string {
  return email.split('@')[0] ?? email;
}
