import { Effect, Layer, Exit } from "effect";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { FeishuChatServiceLive, FeishuChatService } from "../FeishuChatService.js";
import { FeishuAuthService } from "../FeishuAuthService.js";

describe("FeishuChatService", () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCreate = vi.fn();
  });

  const createTestLayer = (mockClient: any) => {
    const MockFeishuAuthService = Layer.succeed(FeishuAuthService, {
      client: mockClient as any,
      getTenantAccessToken: () => Effect.succeed("mock-token")
    });

    return FeishuChatServiceLive.pipe(Layer.provide(MockFeishuAuthService));
  };

  describe("createChat", () => {
    it("should successfully create a chat and return the chatId", async () => {
      mockCreate.mockResolvedValue({
        data: { chat_id: "test-chat-123" }
      });

      const mockClient = {
        im: {
          chat: {
            create: mockCreate
          }
        }
      };

      const TestLayer = createTestLayer(mockClient);

      const program = Effect.gen(function* () {
        const chatService = yield* FeishuChatService;
        return yield* chatService.createChat({
          name: "Test Chat",
          description: "Test Description",
          ownerOpenId: "owner-123",
          userOpenIds: ["user-1", "user-2"]
        });
      });

      const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

      expect(result).toEqual({ chatId: "test-chat-123" });
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          name: "Test Chat",
          description: "Test Description",
          owner_id: "owner-123",
          user_id_list: ["user-1", "user-2"],
        },
        params: { set_bot_manager: true }
      });
    });

    it("should fail when response has no chat_id", async () => {
      mockCreate.mockResolvedValue({
        data: {}
      });

      const mockClient = {
        im: {
          chat: {
            create: mockCreate
          }
        }
      };

      const TestLayer = createTestLayer(mockClient);

      const program = Effect.gen(function* () {
        const chatService = yield* FeishuChatService;
        return yield* chatService.createChat({
          name: "Test Chat",
          description: "Test Description",
          ownerOpenId: "owner-123",
          userOpenIds: ["user-1", "user-2"]
        });
      });

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(TestLayer)));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        expect(result.cause.toString()).toContain("No chat_id in response");
      }
    });

    it("should fail when API call throws an error", async () => {
      mockCreate.mockRejectedValue(new Error("API Error"));

      const mockClient = {
        im: {
          chat: {
            create: mockCreate
          }
        }
      };

      const TestLayer = createTestLayer(mockClient);

      const program = Effect.gen(function* () {
        const chatService = yield* FeishuChatService;
        return yield* chatService.createChat({
          name: "Test Chat",
          description: "Test Description",
          ownerOpenId: "owner-123",
          userOpenIds: ["user-1", "user-2"]
        });
      });

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(TestLayer)));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        expect(result.cause.toString()).toContain("Failed to create chat: API Error");
      }
    });
  });
});
