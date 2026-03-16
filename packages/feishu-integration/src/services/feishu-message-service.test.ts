import { describe, it, expect, mock } from "bun:test";
import { Effect, Layer } from "effect";
import { FeishuMessageService, FeishuMessageServiceLive } from "./FeishuMessageService.js";
import { FeishuAuthService } from "./FeishuAuthService.js";

describe("FeishuMessageService", () => {
  describe("sendText", () => {
    it("should successfully send a text message", async () => {
      const mockCreate = mock().mockResolvedValue({ code: 0, msg: "success" });
      const mockAuthService = {
        client: {
          im: {
            message: {
              create: mockCreate,
            },
          },
        },
      } as unknown as FeishuAuthService;

      const MockAuthLayer = Layer.succeed(FeishuAuthService, mockAuthService);
      const TestLayer = FeishuMessageServiceLive.pipe(Layer.provide(MockAuthLayer));

      const program = Effect.gen(function* () {
        const service = yield* FeishuMessageService;
        yield* service.sendText({ chatId: "chat-123", text: "Hello, World!" });
      });

      await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        params: { receive_id_type: "chat_id" },
        data: {
          receive_id: "chat-123",
          msg_type: "text",
          content: JSON.stringify({ text: "Hello, World!" }),
        },
      });
    });

    it("should fail when message creation throws an error", async () => {
      const mockCreate = mock().mockRejectedValue(new Error("Network Error"));
      const mockAuthService = {
        client: {
          im: {
            message: {
              create: mockCreate,
            },
          },
        },
      } as unknown as FeishuAuthService;

      const MockAuthLayer = Layer.succeed(FeishuAuthService, mockAuthService);
      const TestLayer = FeishuMessageServiceLive.pipe(Layer.provide(MockAuthLayer));

      const program = Effect.gen(function* () {
        const service = yield* FeishuMessageService;
        yield* service.sendText({ chatId: "chat-123", text: "Hello, World!" });
      });

      let error: Error | undefined;
      try {
        await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();
      expect(error?.message).toBe("Failed to send text message: Network Error");
    });
  });
});
