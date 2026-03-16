import { Context, Effect, Layer } from "effect";

import { FeishuError } from "../errors/feishu-error.js";
import { FeishuAuthService } from "./feishu-auth-service.js";

export interface CreateChatParams {
  readonly name: string;
  readonly description: string;
  readonly ownerOpenId: string;
  readonly userOpenIds: readonly string[];
}

export interface ChatResult {
  readonly chatId: string;
}

export class FeishuChatService extends Context.Tag("FeishuChatService")<
  FeishuChatService,
  {
    readonly createChat: (
      params: CreateChatParams
    ) => Effect.Effect<ChatResult, FeishuError>;
    readonly addBotToChat: (chatId: string) => Effect.Effect<void, FeishuError>;
    readonly pinMessage: (
      messageId: string
    ) => Effect.Effect<void, FeishuError>;
  }
>() {}

export const FeishuChatServiceLive = Layer.effect(
  FeishuChatService,
  FeishuAuthService.pipe(
    Effect.map((auth) => ({
      addBotToChat: (chatId: string) =>
        Effect.tryPromise({
          catch: (error) =>
            new FeishuError({
              message: `Failed to add bot to chat: ${error instanceof Error ? error.message : String(error)}`,
            }),
          try: () =>
            auth.client.im.chatMembers.create({
              data: { id_list: [] },
              path: { chat_id: chatId },
            }),
        }).pipe(Effect.asVoid),

      createChat: (params: CreateChatParams) =>
        Effect.tryPromise({
          catch: (error) =>
            new FeishuError({
              message: `Failed to create chat: ${error instanceof Error ? error.message : String(error)}`,
            }),
          try: async () => {
            const resp = await auth.client.im.chat.create({
              data: {
                description: params.description,
                name: params.name,
                owner_id: params.ownerOpenId,
                user_id_list: [...params.userOpenIds],
              },
              params: { set_bot_manager: true },
            });
            const chatId = (resp?.data as { chat_id?: string })?.chat_id;
            if (!chatId) {
              throw new FeishuError({
                message: "No chat_id in response",
              });
            }
            return { chatId };
          },
        }),

      pinMessage: (messageId: string) =>
        Effect.tryPromise({
          catch: (error) =>
            new FeishuError({
              message: `Failed to pin message: ${error instanceof Error ? error.message : String(error)}`,
            }),
          try: () =>
            auth.client.im.pin.create({
              data: { message_id: messageId },
            }),
        }).pipe(Effect.asVoid),
    }))
  )
);
