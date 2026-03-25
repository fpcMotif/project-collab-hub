import { describe, expect, it } from "vitest";

import {
  mapFeishuApprovalStatus,
  mapFeishuTaskToWorkItemStatus,
  mapFeishuWorkflowStatus,
} from "../convex/lib/feishu-maps";

describe("feishu-maps", () => {
  describe("mapFeishuApprovalStatus", () => {
    it("maps known approval statuses", () => {
      expect(mapFeishuApprovalStatus("APPROVED")).toBe("approved");
      expect(mapFeishuApprovalStatus("REJECTED")).toBe("rejected");
      expect(mapFeishuApprovalStatus("CANCELED")).toBe("cancelled");
    });

    it("returns null for unknown or missing status", () => {
      expect(mapFeishuApprovalStatus()).toBeNull();
      expect(mapFeishuApprovalStatus("UNKNOWN")).toBeNull();
    });
  });

  describe("mapFeishuWorkflowStatus", () => {
    it("maps terminal workflow statuses", () => {
      expect(mapFeishuWorkflowStatus("APPROVED")).toBe("approved");
      expect(mapFeishuWorkflowStatus("REJECTED")).toBe("rejected");
      expect(mapFeishuWorkflowStatus("CANCELED")).toBe("cancelled");
      expect(mapFeishuWorkflowStatus("REVERTED")).toBe("cancelled");
    });

    it("treats pending and unknown as running", () => {
      expect(mapFeishuWorkflowStatus("PENDING")).toBe("running");
      expect(mapFeishuWorkflowStatus("WEIRD")).toBe("running");
    });

    it("defaults missing status to running", () => {
      expect(mapFeishuWorkflowStatus()).toBe("running");
    });
  });

  describe("mapFeishuTaskToWorkItemStatus", () => {
    it("maps common Feishu task statuses case-insensitively", () => {
      expect(mapFeishuTaskToWorkItemStatus("DONE")).toBe("done");
      expect(mapFeishuTaskToWorkItemStatus("Not_Started")).toBe("todo");
      expect(mapFeishuTaskToWorkItemStatus("in_review")).toBe("in_review");
    });

    it("returns null for unmapped status", () => {
      expect(mapFeishuTaskToWorkItemStatus("unknown_status")).toBeNull();
    });
  });
});
