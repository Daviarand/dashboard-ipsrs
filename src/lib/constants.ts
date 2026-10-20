/** Application display name */
export const APP_NAME = 'Dashboard IPSRS';

/** Default number of items per page for paginated lists */
export const ITEMS_PER_PAGE = 20;

/** Supabase storage signed URL expiry in seconds */
export const SIGNED_URL_EXPIRY = 60;

/** Maximum file upload size in bytes (10 MB) */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Allowed MIME types for file uploads */
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

/** Auto-refetch interval for real-time-like data freshness (ms) */
export const REFETCH_INTERVAL = 60_000;

/** Logout after 30 minutes without user interaction. */
export const INACTIVITY_TIMEOUT_MS = 30 * 60_000;

/** Email domain used for user authentication */
export const LOGIN_EMAIL_DOMAIN =
  import.meta.env.VITE_LOGIN_EMAIL_DOMAIN?.trim() || 'ipsrs.local';
