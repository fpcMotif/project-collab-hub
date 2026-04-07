import { FeishuChatService } from "@collab-hub/feishu-integration";
import { Effect, Layer } from "effect";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { pinMessageInChat } from "../convex/feishuActions";
import { runFeishu } from "../convex/lib/feishu-layer";

vi.mock("../convex/lib/feishu-layer", () => ({
  runFeishu: vi.fn(),
}));

vi.mock("convex/server", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    internalAction: (def: unknown) => def,
  };
});

vi.mock("../convex/_generated/server", () => ({
  internalAction: (def: unknown) => def,
  internalMutation: (def: unknown) => def,
}));

describe("feishuActions - pinMessageInChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully pin a message (happy path)", async () => {
    const mockPinMessage = vi.fn(() => Effect.succeed());
    const mockLayer = Layer.succeed(
      FeishuChatService,
      FeishuChatService.of({
        createChat: vi.fn(),
        pinMessage: mockPinMessage,
      } as unknown as FeishuChatService)
    );

    vi.mocked(runFeishu).mockImplementation((effect) =>
      Effect.runPromise(
        Effect.provide(
          effect as Effect.Effect<unknown, unknown, FeishuChatService>,
          mockLayer
        )
      )
    );

    const mockCtx = {} as unknown;
    const args = { messageId: "msg-123" };

    const action = pinMessageInChat as unknown as {
      handler: (ctx: unknown, args: { messageId: string }) => Promise<void>;
    };

    await action.handler(mockCtx, args);

    expect(runFeishu).toHaveBeenCalledOnce();
    expect(mockPinMessage).toHaveBeenCalledOnce();
    expect(mockPinMessage).toHaveBeenCalledWith("msg-123");
  });

  it("should propagate errors from the effect (error path)", async () => {
    const error = new Error("Feishu API error");
    const mockPinMessage = vi.fn(() => Effect.fail(error));
    const mockLayer = Layer.succeed(
      FeishuChatService,
      FeishuChatService.of({
        createChat: vi.fn(),
        pinMessage: mockPinMessage,
      } as unknown as FeishuChatService)
    );

    vi.mocked(runFeishu).mockImplementation((effect) =>
      Effect.runPromise(
        Effect.provide(
          effect as Effect.Effect<unknown, unknown, FeishuChatService>,
          mockLayer
        )
      )
    );

    const mockCtx = {} as unknown;
    const args = { messageId: "msg-456" };

    const action = pinMessageInChat as unknown as {
      handler: (ctx: unknown, args: { messageId: string }) => Promise<void>;
    };

    await expect(action.handler(mockCtx, args)).rejects.toThrow(
      "Feishu API error"
    );

    expect(runFeishu).toHaveBeenCalledOnce();
    expect(mockPinMessage).toHaveBeenCalledOnce();
    expect(mockPinMessage).toHaveBeenCalledWith("msg-456");
  });
});
