import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pinMessageInChat } from "../convex/feishuActions";
import { runFeishu } from "../convex/lib/feishu-layer";

// Need to mock convex imports since they require edge environment or convex-test
vi.mock("../convex/_generated/server", () => ({
  internalAction: (opts: unknown) => opts,
  internalMutation: (opts: unknown) => opts,
}));
vi.mock("../convex/_generated/api", () => ({
  internal: {},
}));
vi.mock("convex/values", () => ({
  v: {
    any: () => "any_validator",
    array: () => "array_validator",
    boolean: () => "boolean_validator",
    id: () => "id_validator",
    literal: () => "literal_validator",
    number: () => "number_validator",
    object: () => "object_validator",
    optional: () => "optional_validator",
    record: () => "record_validator",
    string: () => "string_validator",
    union: () => "union_validator",
  },
}));

vi.mock("../convex/lib/feishu-layer", () => ({
  runFeishu: vi.fn(),
}));

describe("feishuActions", () => {
  describe("pinMessageInChat", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("calls runFeishu with the correct effect for pinning a message", async () => {
      // Mock runFeishu to just resolve successfully
      vi.mocked(runFeishu).mockResolvedValueOnce();

      const ctx = {} as unknown;
      const args = { messageId: "msg_12345" };

      // internalAction was mocked to return the raw object with `handler`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actionObj = pinMessageInChat as any;

      await actionObj.handler(ctx, args);

      expect(runFeishu).toHaveBeenCalledTimes(1);

      // Assert it is passed an Effect
      const [[effectArg]] = vi.mocked(runFeishu).mock.calls;
      expect(Effect.isEffect(effectArg)).toBe(true);
    });

    it("throws if runFeishu fails", async () => {
      const mockError = new Error("Feishu API Error");
      vi.mocked(runFeishu).mockRejectedValueOnce(mockError);

      const ctx = {} as unknown;
      const args = { messageId: "msg_12345" };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actionObj = pinMessageInChat as any;

      await expect(actionObj.handler(ctx, args)).rejects.toThrow(
        "Feishu API Error"
      );
      expect(runFeishu).toHaveBeenCalledTimes(1);
    });
  });
});
