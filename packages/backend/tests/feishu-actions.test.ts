import { FeishuApprovalService } from "@collab-hub/feishu-integration";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { internal } from "../convex/_generated/api";
import { submitApproval } from "../convex/feishuActions";
import { runFeishu } from "../convex/lib/feishu-layer";

// Setup mocks first to be hoisted correctly
vi.mock("../convex/lib/feishu-layer", () => ({
  runFeishu: vi.fn(),
}));

vi.mock("../convex/_generated/api", () => ({
  internal: {
    feishuActions: {
      patchApprovalInstanceCode: "mocked-patchApprovalInstanceCode",
    },
  },
}));

vi.mock("@collab-hub/feishu-integration", () => ({
  FeishuApprovalService: {
    pipe: vi.fn(),
  },
}));

describe("feishuActions", () => {
  describe("submitApproval", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockCtx: any;

    beforeEach(() => {
      vi.clearAllMocks();
      mockCtx = {
        runMutation: vi.fn().mockResolvedValue(),
      };
    });

    it("submits approval and runs patch mutation successfully", async () => {
      // Mock the pipe to return a fake effect object
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (FeishuApprovalService.pipe as any).mockReturnValue("fake-effect");

      // Mock runFeishu to return the expected result object
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (runFeishu as any).mockResolvedValue({
        instanceCode: "test-instance-123",
      });

      const args = {
        applicantId: "user-1",
        approvalCode: "app-code-1",
        formData: "{}",
        gateId: "gate-1",
      };

      // Call the handler directly using the _handler property from the generated action wrapper
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (submitApproval as any)._handler(mockCtx, args);

      // Verify Feishu API call was triggered
      expect(runFeishu).toHaveBeenCalledWith("fake-effect");
      expect(FeishuApprovalService.pipe).toHaveBeenCalled();

      // Verify local mutation was run to patch the instance code
      expect(mockCtx.runMutation).toHaveBeenCalledWith(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (internal as any).feishuActions.patchApprovalInstanceCode,
        {
          gateId: "gate-1",
          instanceCode: "test-instance-123",
        }
      );

      // Verify the return value
      expect(result).toBe("test-instance-123");
    });

    it("throws an error if runFeishu fails, and does not run mutation", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (FeishuApprovalService.pipe as any).mockReturnValue("fake-effect");

      const feishuError = new Error("Feishu API failed");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (runFeishu as any).mockRejectedValue(feishuError);

      const args = {
        applicantId: "user-1",
        approvalCode: "app-code-1",
        formData: "{}",
        gateId: "gate-1",
      };

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (submitApproval as any)._handler(mockCtx, args)
      ).rejects.toThrow("Feishu API failed");

      // Mutation should not be called because runFeishu failed
      expect(mockCtx.runMutation).not.toHaveBeenCalled();
    });

    it("throws an error if the patch mutation fails", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (FeishuApprovalService.pipe as any).mockReturnValue("fake-effect");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (runFeishu as any).mockResolvedValue({
        instanceCode: "test-instance-123",
      });

      const dbError = new Error("Database update failed");
      mockCtx.runMutation.mockRejectedValue(dbError);

      const args = {
        applicantId: "user-1",
        approvalCode: "app-code-1",
        formData: "{}",
        gateId: "gate-1",
      };

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (submitApproval as any)._handler(mockCtx, args)
      ).rejects.toThrow("Database update failed");
    });
  });
});
