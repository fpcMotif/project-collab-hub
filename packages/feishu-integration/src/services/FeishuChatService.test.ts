import { describe, expect, it, mock } from "bun:test";
import { Effect, Layer } from "effect";
import { FeishuAuthService } from "./FeishuAuthService.js";
import { FeishuChatService, FeishuChatServiceLive } from "./FeishuChatService.js";

describe("FeishuChatServiceLive", () => {
  it("creates chat with valid parameters", async () => {
    const mockCreate = mock(async () => ({
      data: { chat_id: "test_chat_id" }
    }));

    const MockAuthLayer = Layer.succeed(FeishuAuthService, {
      client: {
        im: {
          chat: {
            create: mockCreate
          }
        }
      } as any,
      getTenantAccessToken: () => Effect.succeed("mock_token")
    });

    const TestLayer = FeishuChatServiceLive.pipe(Layer.provide(MockAuthLayer));

    const program = Effect.gen(function* () {
      const chatService = yield* FeishuChatService;
      return yield* chatService.createChat({
        name: "Test Chat",
        description: "Test Description",
        ownerOpenId: "user_1",
        userOpenIds: ["user_2", "user_3"]
      });
    });

    const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

    expect(result).toEqual({ chatId: "test_chat_id" });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: "Test Chat",
        description: "Test Description",
        owner_id: "user_1",
        user_id_list: ["user_2", "user_3"]
      },
      params: { set_bot_manager: true }
    });
  });

  it("handles empty userOpenIds list correctly", async () => {
    const mockCreate = mock(async () => ({
      data: { chat_id: "test_chat_id_empty" }
    }));

    const MockAuthLayer = Layer.succeed(FeishuAuthService, {
      client: {
        im: {
          chat: {
            create: mockCreate
          }
        }
      } as any,
      getTenantAccessToken: () => Effect.succeed("mock_token")
    });

    const TestLayer = FeishuChatServiceLive.pipe(Layer.provide(MockAuthLayer));

    const program = Effect.gen(function* () {
      const chatService = yield* FeishuChatService;
      return yield* chatService.createChat({
        name: "Test Empty Chat",
        description: "Test Empty Description",
        ownerOpenId: "user_1",
        userOpenIds: []
      });
    });

    const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

    expect(result).toEqual({ chatId: "test_chat_id_empty" });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: "Test Empty Chat",
        description: "Test Empty Description",
        owner_id: "user_1",
        user_id_list: []
      },
      params: { set_bot_manager: true }
    });
  });

  it("handles API errors correctly", async () => {
    const mockCreate = mock(async () => {
      throw new Error("API Error");
    });

    const MockAuthLayer = Layer.succeed(FeishuAuthService, {
      client: {
        im: {
          chat: {
            create: mockCreate
          }
        }
      } as any,
      getTenantAccessToken: () => Effect.succeed("mock_token")
    });

    const TestLayer = FeishuChatServiceLive.pipe(Layer.provide(MockAuthLayer));

    const program = Effect.gen(function* () {
      const chatService = yield* FeishuChatService;
      return yield* chatService.createChat({
        name: "Test Error Chat",
        description: "Test Error Description",
        ownerOpenId: "user_1",
        userOpenIds: ["user_2"]
      });
    });

    const result = Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

    expect(result).rejects.toThrow("Failed to create chat: API Error");
  });
});
