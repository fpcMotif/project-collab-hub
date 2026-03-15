import { Context, Effect, Layer } from "effect";
import { FeishuAuthService } from "./FeishuAuthService.js";
import { FeishuError } from "../errors/FeishuError.js";

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
      params: SendTextMessageParams,
    ) => Effect.Effect<void, FeishuError>;
    readonly sendCard: (
      params: SendCardMessageParams,
    ) => Effect.Effect<void, FeishuError>;
  }
>() {}

export const FeishuMessageServiceLive = Layer.effect(
  FeishuMessageService,
  Effect.map(FeishuAuthService, (auth) => ({
    sendText: (params: SendTextMessageParams) =>
      Effect.tryPromise({
        try: () =>
          auth.client.im.message.create({
            params: { receive_id_type: "chat_id" },
            data: {
              receive_id: params.chatId,
              msg_type: "text",
              content: JSON.stringify({ text: params.text }),
            },
          }),
        catch: (error) =>
          new FeishuError({ message: `Failed to send text message: ${error instanceof Error ? error.message : String(error)}` }),
      }).pipe(Effect.asVoid),

    sendCard: (params: SendCardMessageParams) =>
      Effect.tryPromise({
        try: () =>
          auth.client.im.message.create({
            params: { receive_id_type: "chat_id" },
            data: {
              receive_id: params.chatId,
              msg_type: "interactive",
              content: JSON.stringify(params.card),
            },
          }),
        catch: (error) =>
          new FeishuError({ message: `Failed to send card message: ${error instanceof Error ? error.message : String(error)}` }),
      }).pipe(Effect.asVoid),
  })),
);
