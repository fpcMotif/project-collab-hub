/** Max delivery attempts before marking a notification as failed. */
export const MAX_NOTIFICATION_RETRY_COUNT = 3;

/** Delay before each retry attempt (indexed by current `retryCount`). */
export const NOTIFICATION_RETRY_DELAY_MS = [5000, 30_000, 120_000] as const;

export const getNotificationRetryDelayMs = (retryCount: number): number =>
  NOTIFICATION_RETRY_DELAY_MS[retryCount] ??
  NOTIFICATION_RETRY_DELAY_MS.at(-1) ??
  120_000;
