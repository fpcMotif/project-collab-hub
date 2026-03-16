import { Context, Effect, Layer } from "effect";

import { FeishuError } from "../errors/feishu-error.js";
import { FeishuAuthService } from "./feishu-auth-service.js";

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
    Effect.map((auth) => ({
      sendCard: (params: SendCardMessageParams) =>
        Effect.tryPromise({
          catch: (error) =>
            new FeishuError({
              message: `Failed to send card message: ${error instanceof Error ? error.message : String(error)}`,
            }),
          try: () =>
            auth.client.im.message.create({
              data: {
                content: JSON.stringify(params.card),
                msg_type: "interactive",
                receive_id: params.chatId,
              },
              params: { receive_id_type: "chat_id" },
            }),
        }).pipe(Effect.asVoid),

      sendText: (params: SendTextMessageParams) =>
        Effect.tryPromise({
          catch: (error) =>
            new FeishuError({
              message: `Failed to send text message: ${error instanceof Error ? error.message : String(error)}`,
            }),
          try: () =>
            auth.client.im.message.create({
              data: {
                content: JSON.stringify({ text: params.text }),
                msg_type: "text",
                receive_id: params.chatId,
              },
              params: { receive_id_type: "chat_id" },
            }),
        }).pipe(Effect.asVoid),
    }))
  )
);
