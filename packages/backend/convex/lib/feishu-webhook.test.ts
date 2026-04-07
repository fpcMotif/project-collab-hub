import { describe, expect, it } from "bun:test";

import {
  createFeishuSignature,
  extractProjectIdFromUrl,
  isFreshFeishuTimestamp,
  mapApprovalStatus,
  mapTaskStatus,
  sanitizeLogInput,
  parseJsonRecord,
  isRecord,
} from "./feishu-webhook";

describe("feishuWebhook helpers", () => {
  it("sanitizes log input and trims control characters", () => {
    expect(sanitizeLogInput("task.updated\r\nmalicious\tentry")).toBe(
      "task.updated malicious entry"
    );
  });

  it("truncates log input exceeding max length", () => {
    const longInput = "a".repeat(200);
    expect(sanitizeLogInput(longInput).length).toBeLessThanOrEqual(120);
  });

  it("maps completed task events to done work items", () => {
    expect(mapTaskStatus({ status: "COMPLETED" }, "task.updated")).toEqual({
      feishuStatus: "completed",
      workItemStatus: "done",
    });
  });

  it("maps in_progress task events correctly", () => {
    expect(mapTaskStatus({ status: "in_progress" }, "task.updated")).toEqual({
      feishuStatus: "in_progress",
      workItemStatus: "in_progress",
    });
  });

  it("falls back to eventType when event has no status fields", () => {
    expect(mapTaskStatus({}, "task.completed")).toEqual({
      feishuStatus: "completed",
      workItemStatus: "done",
    });
  });

  it("returns null for unsupported task statuses", () => {
    expect(mapTaskStatus({ status: "PAUSED" }, "task.updated")).toBeNull();
  });

  it("maps Feishu approval statuses correctly", () => {
    expect(mapApprovalStatus("APPROVED")).toBe("approved");
    expect(mapApprovalStatus("REJECTED")).toBe("rejected");
    expect(mapApprovalStatus("CANCELED")).toBe("cancelled");
    expect(mapApprovalStatus("UNKNOWN")).toBeNull();
    expect(mapApprovalStatus(null)).toBeNull();
  });

  it("extracts project ids from preview URLs", () => {
    expect(
      extractProjectIdFromUrl("https://example.com/projects/project_123")
    ).toBe("project_123");
  });

  it("returns null for URLs without project path", () => {
    expect(extractProjectIdFromUrl("https://example.com/dashboard")).toBeNull();
  });

  it("validates fresh timestamps within the accepted skew", () => {
    expect(isFreshFeishuTimestamp("1000", 1_000_000, 5000)).toBe(true);
    expect(isFreshFeishuTimestamp("1000", 1_010_001, 5000)).toBe(false);
  });

  it("rejects non-numeric timestamps", () => {
    expect(isFreshFeishuTimestamp("not-a-number", 1_000_000, 5000)).toBe(false);
  });

  it("produces deterministic Feishu request signatures", async () => {
    await expect(
      createFeishuSignature("secret", "1000", "nonce", '{"ok":true}')
    ).resolves.toBe("RiSrhYBpTF6IgGmVxHBeEVFmcOCPKjJ7L1AY0gMwgeM=");
  });

  describe("isRecord", () => {
    it("returns true for objects", () => {
      expect(isRecord({ a: 1 })).toBe(true);
      expect(isRecord({})).toBe(true);
    });

    it("returns false for non-objects or null", () => {
      expect(isRecord(null)).toBe(false);
      expect(isRecord()).toBe(false);
      expect(isRecord([])).toBe(false);
      expect(isRecord([1, 2, 3])).toBe(false);
      expect(isRecord("string")).toBe(false);
      expect(isRecord(123)).toBe(false);
    });
  });

  describe("parseJsonRecord", () => {
    it("parses valid JSON records successfully", () => {
      expect(parseJsonRecord('{"ok":true,"data":123}')).toEqual({
        data: 123,
        ok: true,
      });
    });

    it("returns null when JSON parsing fails (error path)", () => {
      expect(parseJsonRecord("invalid json string")).toBeNull();
      expect(parseJsonRecord("")).toBeNull();
      expect(parseJsonRecord("{ bad json }")).toBeNull();
    });

    it("returns null if parsed JSON is not a record", () => {
      expect(parseJsonRecord("[1, 2, 3]")).toBeNull();
      expect(parseJsonRecord('"just a string"')).toBeNull();
      expect(parseJsonRecord("1234")).toBeNull();
      expect(parseJsonRecord("null")).toBeNull();
    });
  });
});
