import { expect, describe, test } from "bun:test";
import { Effect, Layer } from "effect";
import {
  FeishuChatService,
  FeishuChatServiceLive,
} from "../FeishuChatService.js";
import { FeishuAuthService } from "../FeishuAuthService.js";
import * as lark from "@larksuiteoapi/node-sdk";

describe("FeishuChatService", () => {
  describe("createChat", () => {
    test("should return error when no chat_id in response", async () => {
      // Create a mock FeishuAuthService that returns a response without chat_id
      const MockFeishuAuthService = Layer.succeed(
        FeishuAuthService,
        FeishuAuthService.of({
          client: {
            im: {
              chat: {
                create: async () => ({ data: {} }),
              },
            },
          } as unknown as lark.Client,
          getTenantAccessToken: () => Effect.succeed("mock_token"),
        })
      );

      // Create a program that uses FeishuChatService to create a chat
      const program = Effect.gen(function* () {
        const chatService = yield* FeishuChatService;
        return yield* chatService.createChat({
          name: "Test Chat",
          description: "Test Description",
          ownerOpenId: "owner123",
          userOpenIds: ["user1", "user2"],
        });
      });

      // Provide the mocked dependencies to the program
      const runnable = program.pipe(
        Effect.provide(FeishuChatServiceLive),
        Effect.provide(MockFeishuAuthService)
      );

      // Assert that running the program results in the expected error
      await expect(Effect.runPromise(runnable)).rejects.toThrow(
        "Failed to create chat: No chat_id in response"
      );
    });
  });
});
