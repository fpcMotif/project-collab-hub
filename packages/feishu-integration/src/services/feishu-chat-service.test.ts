import { describe, expect, it, mock } from "bun:test";
import { Effect, Layer } from "effect";
import { FeishuAuthService } from "./feishu-auth-service.js";
import { FeishuChatService, FeishuChatServiceLive } from "./feishu-chat-service.js";

const createTestLayer = (createChatMock: ReturnType<typeof mock>, createChatMembersMock: ReturnType<typeof mock>, createPinMock: ReturnType<typeof mock>) =>
  FeishuChatServiceLive.pipe(
    Layer.provide(
      Layer.succeed(FeishuAuthService, {
        client: {
          im: {
            chat: {
              create: createChatMock,
            },
            chatMembers: {
              create: createChatMembersMock,
            },
            pin: {
              create: createPinMock,
            },
          },
        },
      } as unknown as FeishuAuthService)
    )
  );

describe("FeishuChatService", () => {
  describe("createChat", () => {
    it("creates a chat successfully", async () => {
      const createChat = mock().mockResolvedValue({
        data: { chat_id: "chat-123" },
      });
      const testLayer = createTestLayer(createChat, mock(), mock());

      const result = await Effect.runPromise(
        FeishuChatService.pipe(
          Effect.andThen((service) =>
            service.createChat({
              name: "Test Chat",
              description: "A test chat",
              ownerOpenId: "user-1",
              userOpenIds: ["user-2", "user-3"],
            })
          ),
          Effect.provide(testLayer)
        )
      );

      expect(result).toEqual({ chatId: "chat-123" });
      expect(createChat).toHaveBeenCalledTimes(1);
      expect(createChat).toHaveBeenCalledWith({
        data: {
          description: "A test chat",
          name: "Test Chat",
          owner_id: "user-1",
          user_id_list: ["user-2", "user-3"],
        },
        params: { set_bot_manager: true },
      });
    });

    it("fails when chat_id is missing from response", async () => {
      const createChat = mock().mockResolvedValue({
        data: { something_else: "abc" },
      });
      const testLayer = createTestLayer(createChat, mock(), mock());

      const runEffect = Effect.runPromise(
        FeishuChatService.pipe(
          Effect.andThen((service) =>
            service.createChat({
              name: "Test Chat",
              description: "A test chat",
              ownerOpenId: "user-1",
              userOpenIds: ["user-2", "user-3"],
            })
          ),
          Effect.provide(testLayer)
        )
      );

      await expect(runEffect).rejects.toThrow("Failed to create chat: No chat_id in response");
    });

    it("fails when Feishu API throws an error", async () => {
      const createChat = mock().mockRejectedValue(new Error("Network error"));
      const testLayer = createTestLayer(createChat, mock(), mock());

      const runEffect = Effect.runPromise(
        FeishuChatService.pipe(
          Effect.andThen((service) =>
            service.createChat({
              name: "Test Chat",
              description: "A test chat",
              ownerOpenId: "user-1",
              userOpenIds: ["user-2", "user-3"],
            })
          ),
          Effect.provide(testLayer)
        )
      );

      await expect(runEffect).rejects.toThrow("Failed to create chat: Network error");
    });
  });

  describe("addBotToChat", () => {
    it("adds bot to chat successfully", async () => {
      const createChatMembers = mock().mockResolvedValue({ code: 0, msg: "success" });
      const testLayer = createTestLayer(mock(), createChatMembers, mock());

      await Effect.runPromise(
        FeishuChatService.pipe(
          Effect.andThen((service) => service.addBotToChat("chat-123")),
          Effect.provide(testLayer)
        )
      );

      expect(createChatMembers).toHaveBeenCalledTimes(1);
      expect(createChatMembers).toHaveBeenCalledWith({
        data: { id_list: [] },
        path: { chat_id: "chat-123" },
      });
    });

    it("fails when Feishu API throws an error", async () => {
      const createChatMembers = mock().mockRejectedValue(new Error("Network error"));
      const testLayer = createTestLayer(mock(), createChatMembers, mock());

      const runEffect = Effect.runPromise(
        FeishuChatService.pipe(
          Effect.andThen((service) => service.addBotToChat("chat-123")),
          Effect.provide(testLayer)
        )
      );

      await expect(runEffect).rejects.toThrow("Failed to add bot to chat: Network error");
    });
  });

  describe("pinMessage", () => {
    it("pins a message successfully", async () => {
      const createPin = mock().mockResolvedValue({ code: 0, msg: "success" });
      const testLayer = createTestLayer(mock(), mock(), createPin);

      await Effect.runPromise(
        FeishuChatService.pipe(
          Effect.andThen((service) => service.pinMessage("msg-123")),
          Effect.provide(testLayer)
        )
      );

      expect(createPin).toHaveBeenCalledTimes(1);
      expect(createPin).toHaveBeenCalledWith({
        data: { message_id: "msg-123" },
      });
    });

    it("fails when Feishu API throws an error", async () => {
      const createPin = mock().mockRejectedValue(new Error("Network error"));
      const testLayer = createTestLayer(mock(), mock(), createPin);

      const runEffect = Effect.runPromise(
        FeishuChatService.pipe(
          Effect.andThen((service) => service.pinMessage("msg-123")),
          Effect.provide(testLayer)
        )
      );

      await expect(runEffect).rejects.toThrow("Failed to pin message: Network error");
    });
  });
});
