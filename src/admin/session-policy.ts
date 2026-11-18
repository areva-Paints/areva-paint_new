/*
 * Share the five-minute admin inactivity limit, eight-hour absolute session cap and server timing contract between browser and backend.
 */
export const ADMIN_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
export const ADMIN_ACTIVITY_INTERVAL_MS = 15 * 1000;
export const ADMIN_ACTIVITY_MAX_DELAY_MS = 60 * 1000;
export const ACCOUNT_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

// activityId identifies a session for tab coordination; it is not an auth token.
export interface AdminSessionTiming {
  activityId: string;
  serverTime: number;
  idleExpiresAt: number;
  expiresAt: number;
}
