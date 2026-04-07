import { describe, expect, it } from "bun:test";

import {
  createFeishuSignature,
  extractProjectIdFromUrl,
  isFreshFeishuTimestamp,
  mapApprovalStatus,
  mapTaskStatus,
  sanitizeLogInput,
  parseJsonRecord,
} from "./feishu-webhook";


describe("parseJsonRecord", () => {
  it("returns parsed object for valid JSON record", () => {
    expect(parseJsonRecord('{"foo": "bar", "baz": 123}')).toEqual({ foo: "bar", baz: 123 });
  });

  it("returns null for invalid JSON string", () => {
    // This covers the catch block error path
    expect(parseJsonRecord('{invalid_json}')).toBeNull();
  });

  it("returns null for valid JSON array", () => {
    expect(parseJsonRecord('["a", "b"]')).toBeNull();
  });

  it("returns null for valid JSON primitive", () => {
    expect(parseJsonRecord('"a string"')).toBeNull();
    expect(parseJsonRecord('123')).toBeNull();
    expect(parseJsonRecord('true')).toBeNull();
  });

  it("returns null for valid JSON null", () => {
    expect(parseJsonRecord('null')).toBeNull();
  });
});

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
});
