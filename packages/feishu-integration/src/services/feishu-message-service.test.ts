import { describe, expect, it, mock } from "bun:test";

import { Effect, Layer } from "effect";

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

  it("fails when Feishu rejects a card message", async () => {
    const createMessage = mock().mockResolvedValue({
      code: 902,
      msg: "card validation failed",
    });
    const testLayer = createTestLayer(createMessage);

    await expect(runSendCard(testLayer)).rejects.toThrow(
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
});
