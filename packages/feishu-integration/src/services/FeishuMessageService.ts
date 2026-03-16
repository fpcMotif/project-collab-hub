import { Context, Effect, Layer } from "effect";
import { FeishuAuthService } from "./FeishuAuthService.js";

export interface SendTextMessageParams {
  readonly receiveId: string;
  readonly receiveIdType: "chat_id" | "open_id";
  readonly text: string;
}

export interface SendCardMessageParams {
  readonly receiveId: string;
  readonly receiveIdType: "chat_id" | "open_id";
  readonly card: Record<string, unknown>;
}

export class FeishuMessageService extends Context.Tag("FeishuMessageService")<
  FeishuMessageService,
  {
    readonly sendText: (
      params: SendTextMessageParams,
    ) => Effect.Effect<string, Error>;
    readonly sendCard: (
      params: SendCardMessageParams,
    ) => Effect.Effect<string, Error>;
  }
>() {}

export const FeishuMessageServiceLive = Layer.effect(
  FeishuMessageService,
  Effect.map(FeishuAuthService, (auth) => ({
    sendText: (params: SendTextMessageParams) =>
      Effect.tryPromise({
        try: async () => {
          const response = await auth.client.im.message.create({
            params: { receive_id_type: params.receiveIdType },
            data: {
              receive_id: params.receiveId,
              msg_type: "text",
              content: JSON.stringify({ text: params.text }),
            },
          });

          return response.data?.message_id ?? "";
        },
        catch: (error) =>
          new Error(
            `Failed to send text message: ${error instanceof Error ? error.message : String(error)}`,
          ),
      }),

    sendCard: (params: SendCardMessageParams) =>
      Effect.tryPromise({
        try: async () => {
          const response = await auth.client.im.message.create({
            params: { receive_id_type: params.receiveIdType },
            data: {
              receive_id: params.receiveId,
              msg_type: "interactive",
              content: JSON.stringify(params.card),
            },
          });

          return response.data?.message_id ?? "";
        },
        catch: (error) =>
          new Error(
            `Failed to send card message: ${error instanceof Error ? error.message : String(error)}`,
          ),
      }),
  })),
);
