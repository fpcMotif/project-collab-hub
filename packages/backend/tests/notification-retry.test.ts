import { describe, expect, it } from "vitest";

import {
  getNotificationRetryDelayMs,
  MAX_NOTIFICATION_RETRY_COUNT,
  NOTIFICATION_RETRY_DELAY_MS,
} from "../convex/lib/notification-retry";

describe("notification-retry", () => {
  it("exposes capped retry count aligned with delay table length", () => {
    expect(MAX_NOTIFICATION_RETRY_COUNT).toBe(
      NOTIFICATION_RETRY_DELAY_MS.length
    );
  });

  it("returns increasing delays per retry index", () => {
    expect(getNotificationRetryDelayMs(0)).toBe(5000);
    expect(getNotificationRetryDelayMs(1)).toBe(30_000);
    expect(getNotificationRetryDelayMs(2)).toBe(120_000);
  });

  it("clamps to last delay for out-of-range indices", () => {
    expect(getNotificationRetryDelayMs(99)).toBe(120_000);
  });
});
