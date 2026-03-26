import { describe, expect, it, mock } from "bun:test";

import { Effect, Either, Layer } from "effect";

import { FeishuError } from "../errors/feishu-error.js";
import { FeishuAuthService } from "./feishu-auth-service.js";
import {
  FeishuMessageService,
  FeishuMessageServiceLive,
} from "./feishu-message-service.js";

const cardPayload = {
  elements: [],
  header: { title: { content: "Hello" } },
} as const;

const createTestLayer = (createMessage: ReturnType<typeof mock>) =>
  FeishuMessageServiceLive.pipe(
    Layer.provide(
      Layer.succeed(FeishuAuthService, {
        client: {
          im: {
            message: {
              create: createMessage,
            },
          },
        },
      } as unknown as FeishuAuthService)
    )
  );

const runSendText = (testLayer: ReturnType<typeof createTestLayer>) =>
  Effect.runPromise(
    FeishuMessageService.pipe(
      Effect.andThen((service) =>
        service.sendText({ chatId: "chat-123", text: "Hello, World!" })
      ),
      Effect.provide(testLayer)
    )
  );

const runSendCard = (testLayer: ReturnType<typeof createTestLayer>) =>
  Effect.runPromise(
    FeishuMessageService.pipe(
      Effect.andThen((service) =>
        service.sendCard({ card: cardPayload, chatId: "chat-123" })
      ),
      Effect.provide(testLayer)
    )
  );

const runSendCardEither = (testLayer: ReturnType<typeof createTestLayer>) =>
  Effect.runPromise(
    FeishuMessageService.pipe(
      Effect.andThen((service) =>
        service.sendCard({ card: cardPayload, chatId: "chat-123" })
      ),
      Effect.provide(testLayer),
      Effect.either
    )
  );

describe("FeishuMessageService", () => {
  it("sends a text message with the expected payload", async () => {
    const createMessage = mock().mockResolvedValue({ code: 0, msg: "success" });
    const testLayer = createTestLayer(createMessage);

    await runSendText(testLayer);

    expect(createMessage).toHaveBeenCalledTimes(1);
    expect(createMessage).toHaveBeenCalledWith({
      data: {
        content: JSON.stringify({ text: "Hello, World!" }),
        msg_type: "text",
        receive_id: "chat-123",
      },
      params: { receive_id_type: "chat_id" },
    });
  });

  it("sends a card message with the expected payload", async () => {
    const createMessage = mock().mockResolvedValue({ code: 0, msg: "success" });
    const testLayer = createTestLayer(createMessage);

    await runSendCard(testLayer);

    expect(createMessage).toHaveBeenCalledTimes(1);
    expect(createMessage).toHaveBeenCalledWith({
      data: {
        content: JSON.stringify(cardPayload),
        msg_type: "interactive",
        receive_id: "chat-123",
      },
      params: { receive_id_type: "chat_id" },
    });
  });

  it("fails when Feishu rejects a text message", async () => {
    const createMessage = mock().mockResolvedValue({
      code: 999,
      msg: "permission denied",
    });
    const testLayer = createTestLayer(createMessage);

    await expect(runSendText(testLayer)).rejects.toThrow(
      "Failed to send text message: Feishu API failed with code 999: permission denied"
    );
  });

  it("returns FeishuError when sending an interactive message fails", async () => {
    const createMessage = mock().mockResolvedValue({
      code: 902,
      msg: "card validation failed",
    });
    const testLayer = createTestLayer(createMessage);
    const result = await runSendCardEither(testLayer);

    expect(Either.isLeft(result)).toBe(true);

    if (Either.isRight(result)) {
      throw new Error("Expected sendCard to fail");
    }

    expect(result.left).toBeInstanceOf(FeishuError);
    expect(result.left.message).toBe(
      "Failed to send card message: Feishu API failed with code 902: card validation failed"
    );
  });

  it("fails when message creation throws an error", async () => {
    const createMessage = mock().mockRejectedValue(new Error("Network Error"));
    const testLayer = createTestLayer(createMessage);

    await expect(runSendText(testLayer)).rejects.toThrow(
      "Failed to send text message: Network Error"
    );
  });

  describe("updateCard", () => {
    it("updates a card message with the expected payload", async () => {
      const patchMessage = mock().mockResolvedValue({
        code: 0,
        msg: "success",
      });
      const testLayer = FeishuMessageServiceLive.pipe(
        Layer.provide(
          Layer.succeed(FeishuAuthService, {
            client: { im: { message: { patch: patchMessage } } },
          } as unknown as FeishuAuthService)
        )
      );

      const card = { header: { title: { content: "Updated" } } };
      await Effect.runPromise(
        FeishuMessageService.pipe(
          Effect.andThen((service) =>
            service.updateCard({ card, messageId: "msg-1" })
          ),
          Effect.provide(testLayer)
        )
      );

      expect(patchMessage).toHaveBeenCalledWith({
        data: { content: JSON.stringify(card) },
        path: { message_id: "msg-1" },
      });
    });

    it("fails when Feishu returns non-zero code on update", async () => {
      const patchMessage = mock().mockResolvedValue({
        code: 1,
        msg: "invalid content",
      });
      const testLayer = FeishuMessageServiceLive.pipe(
        Layer.provide(
          Layer.succeed(FeishuAuthService, {
            client: { im: { message: { patch: patchMessage } } },
          } as unknown as FeishuAuthService)
        )
      );

      await expect(
        Effect.runPromise(
          FeishuMessageService.pipe(
            Effect.andThen((service) =>
              service.updateCard({ card: {}, messageId: "msg-1" })
            ),
            Effect.provide(testLayer)
          )
        )
      ).rejects.toThrow("Feishu API failed with code 1: invalid content");
    });
  });
});
