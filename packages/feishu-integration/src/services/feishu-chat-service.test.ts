import { describe, expect, it, mock } from "bun:test";

import { Effect, Layer } from "effect";

import { FeishuAuthService } from "./feishu-auth-service.js";
import {
  FeishuChatService,
  FeishuChatServiceLive,
} from "./feishu-chat-service.js";

const createTestLayer = (mocks: {
  createChat?: ReturnType<typeof mock>;
  addBot?: ReturnType<typeof mock>;
  pinMessage?: ReturnType<typeof mock>;
}) =>
  FeishuChatServiceLive.pipe(
    Layer.provide(
      Layer.succeed(FeishuAuthService, {
        client: {
          im: {
            chat: {
              create: mocks.createChat ?? mock().mockResolvedValue({}),
            },
            chatMembers: {
              create: mocks.addBot ?? mock().mockResolvedValue({}),
            },
            pin: {
              create: mocks.pinMessage ?? mock().mockResolvedValue({}),
            },
          },
        },
      } as unknown as FeishuAuthService)
    )
  );

const runCreateChat = (
  testLayer: ReturnType<typeof createTestLayer>,
  params?: {
    description: string;
    name: string;
    ownerOpenId: string;
    userOpenIds: string[];
  }
) => {
  const finalParams = params ?? {
    description: "A test chat",
    name: "Test Chat",
    ownerOpenId: "ou_123",
    userOpenIds: ["ou_456", "ou_789"],
  };
  return Effect.runPromise(
    FeishuChatService.pipe(
      Effect.andThen((service) => service.createChat(finalParams)),
      Effect.provide(testLayer)
    )
  );
};

const runAddBotToChat = (testLayer: ReturnType<typeof createTestLayer>) =>
  Effect.runPromise(
    FeishuChatService.pipe(
      Effect.andThen((service) => service.addBotToChat("chat_123")),
      Effect.provide(testLayer)
    )
  );

const runPinMessage = (testLayer: ReturnType<typeof createTestLayer>) =>
  Effect.runPromise(
    FeishuChatService.pipe(
      Effect.andThen((service) => service.pinMessage("msg_123")),
      Effect.provide(testLayer)
    )
  );

describe("FeishuChatService", () => {
  describe("createChat", () => {
    it("successfully creates a chat and returns the chat ID", async () => {
      const createChatMock = mock().mockResolvedValue({
        code: 0,
        data: { chat_id: "new_chat_123" },
        msg: "success",
      });
      const testLayer = createTestLayer({ createChat: createChatMock });

      const result = await runCreateChat(testLayer);

      expect(result).toEqual({ chatId: "new_chat_123" });
      expect(createChatMock).toHaveBeenCalledTimes(1);
      expect(createChatMock).toHaveBeenCalledWith({
        data: {
          description: "A test chat",
          name: "Test Chat",
          owner_id: "ou_123",
          user_id_list: ["ou_456", "ou_789"],
        },
        params: { set_bot_manager: true },
      });
    });

    it("fails when the API response is missing a chat_id", async () => {
      const createChatMock = mock().mockResolvedValue({
        code: 0,
        data: {},
        msg: "success",
      });
      const testLayer = createTestLayer({ createChat: createChatMock });

      await expect(runCreateChat(testLayer)).rejects.toThrow(
        "Failed to create chat: No chat_id in response"
      );
    });

    it("fails when the API call throws an error", async () => {
      const createChatMock = mock().mockRejectedValue(
        new Error("Network Error")
      );
      const testLayer = createTestLayer({ createChat: createChatMock });

      await expect(runCreateChat(testLayer)).rejects.toThrow(
        "Failed to create chat: Network Error"
      );
    });
  });

  describe("addBotToChat", () => {
    it("successfully adds bot to the chat", async () => {
      const addBotMock = mock().mockResolvedValue({
        code: 0,
        msg: "success",
      });
      const testLayer = createTestLayer({ addBot: addBotMock });

      await runAddBotToChat(testLayer);

      expect(addBotMock).toHaveBeenCalledTimes(1);
      expect(addBotMock).toHaveBeenCalledWith({
        data: { id_list: [] },
        path: { chat_id: "chat_123" },
      });
    });

    it("fails when the API call throws an error", async () => {
      const addBotMock = mock().mockRejectedValue(new Error("Network Error"));
      const testLayer = createTestLayer({ addBot: addBotMock });

      await expect(runAddBotToChat(testLayer)).rejects.toThrow(
        "Failed to add bot to chat: Network Error"
      );
    });
  });

  describe("pinMessage", () => {
    it("successfully pins the message", async () => {
      const pinMessageMock = mock().mockResolvedValue({
        code: 0,
        msg: "success",
      });
      const testLayer = createTestLayer({ pinMessage: pinMessageMock });

      await runPinMessage(testLayer);

      expect(pinMessageMock).toHaveBeenCalledTimes(1);
      expect(pinMessageMock).toHaveBeenCalledWith({
        data: { message_id: "msg_123" },
      });
    });

    it("fails when the API call throws an error", async () => {
      const pinMessageMock = mock().mockRejectedValue(
        new Error("Network Error")
      );
      const testLayer = createTestLayer({ pinMessage: pinMessageMock });

      await expect(runPinMessage(testLayer)).rejects.toThrow(
        "Failed to pin message: Network Error"
      );
    });
  });
});
