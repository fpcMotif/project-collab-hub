import { Context, Effect, Layer } from "effect";

import { FeishuError } from "../errors/feishu-error.js";
import { FeishuAuthService } from "./feishu-auth-service.js";
import { assertFeishuSuccess, wrapFeishuError } from "./feishu-response.js";

export interface SendTextMessageParams {
  readonly chatId: string;
  readonly text: string;
}

export interface SendCardMessageParams {
  readonly chatId: string;
  readonly card: Record<string, unknown>;
}

export class FeishuMessageService extends Context.Tag("FeishuMessageService")<
  FeishuMessageService,
  {
    readonly sendText: (
      params: SendTextMessageParams
    ) => Effect.Effect<void, FeishuError>;
    readonly sendCard: (
      params: SendCardMessageParams
    ) => Effect.Effect<void, FeishuError>;
  }
>() {}

export const FeishuMessageServiceLive = Layer.effect(
  FeishuMessageService,
  FeishuAuthService.pipe(
    Effect.map((auth) => {
      const chatIdReceiveParams = { receive_id_type: "chat_id" } as const;

      const sendMessage = (params: {
        readonly chatId: string;
        readonly content: string;
        readonly failurePrefix: string;
        readonly messageType: "interactive" | "text";
      }): Effect.Effect<void, Error> =>
        Effect.tryPromise({
          catch: (error) => wrapFeishuError(params.failurePrefix, error),
          try: async () => {
            const response = await auth.client.im.message.create({
              data: {
                content: params.content,
                msg_type: params.messageType,
                receive_id: params.chatId,
              },
              params: chatIdReceiveParams,
            });

            assertFeishuSuccess(response);
          },
        });

      return {
        sendCard: (params: SendCardMessageParams) =>
          sendMessage({
            chatId: params.chatId,
            content: JSON.stringify(params.card),
            failurePrefix: "Failed to send card message",
            messageType: "interactive",
          }),

        sendText: (params: SendTextMessageParams) =>
          sendMessage({
            chatId: params.chatId,
            content: JSON.stringify({ text: params.text }),
            failurePrefix: "Failed to send text message",
            messageType: "text",
          }),
      };
    })
  )
);
