import { describe, expect, it } from "vitest";

import {
  extractBaseRecordIdFromEvent,
  isValidConvexWorkItemId,
} from "../convex/lib/feishu-http-utils";

describe("feishu-http-utils", () => {
  it("validates Convex work item ids", () => {
    const valid = "a".repeat(32);
    expect(isValidConvexWorkItemId(valid)).toBe(true);
    expect(isValidConvexWorkItemId("short")).toBe(false);
    expect(isValidConvexWorkItemId(`${"a".repeat(32)}x`)).toBe(false);
  });

  it("extracts record id from event.record_id", () => {
    expect(extractBaseRecordIdFromEvent({ record_id: "rec-1" })).toBe("rec-1");
  });

  it("extracts record id from action_list[0].record_id", () => {
    expect(
      extractBaseRecordIdFromEvent({
        action_list: [{ record_id: "rec-2" }],
      })
    ).toBe("rec-2");
  });

  it("prefers top-level record_id when both are present", () => {
    expect(
      extractBaseRecordIdFromEvent({
        action_list: [{ record_id: "rec-b" }],
        record_id: "rec-a",
      })
    ).toBe("rec-a");
  });

  it("returns undefined when no record id is present", () => {
    expect(extractBaseRecordIdFromEvent({})).toBeUndefined();
  });
});
