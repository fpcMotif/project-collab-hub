import { Context, Effect, Layer } from "effect";
import { FeishuAuthService } from "./FeishuAuthService.js";
import { FeishuError } from "../errors/FeishuError.js";

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
      params: CreateChatParams,
    ) => Effect.Effect<ChatResult, FeishuError>;
    readonly addBotToChat: (chatId: string) => Effect.Effect<void, FeishuError>;
    readonly pinMessage: (
      messageId: string,
    ) => Effect.Effect<void, FeishuError>;
  }
>() {}

export const FeishuChatServiceLive = Layer.effect(
  FeishuChatService,
  Effect.map(FeishuAuthService, (auth) => ({
    createChat: (params: CreateChatParams) =>
      Effect.tryPromise({
        try: async () => {
          const resp = await auth.client.im.chat.create({
            data: {
              name: params.name,
              description: params.description,
              owner_id: params.ownerOpenId,
              user_id_list: [...params.userOpenIds],
            },
            params: { set_bot_manager: true },
          });
          const chatId = (resp?.data as { chat_id?: string })?.chat_id;
          if (!chatId) {
            throw new FeishuError({ message: "No chat_id in response" });
          }
          return { chatId };
        },
        catch: (error) =>
          new FeishuError({ message: `Failed to create chat: ${error instanceof Error ? error.message : String(error)}` }),
      }),

    addBotToChat: (chatId: string) =>
      Effect.tryPromise({
        try: () =>
          auth.client.im.chatMembers.create({
            path: { chat_id: chatId },
            data: { id_list: [] },
          }),
        catch: (error) =>
          new FeishuError({ message: `Failed to add bot to chat: ${error instanceof Error ? error.message : String(error)}` }),
      }).pipe(Effect.asVoid),

    pinMessage: (messageId: string) =>
      Effect.tryPromise({
        try: () =>
          auth.client.im.pin.create({
            data: { message_id: messageId },
          }),
        catch: (error) =>
          new FeishuError({ message: `Failed to pin message: ${error instanceof Error ? error.message : String(error)}` }),
      }).pipe(Effect.asVoid),
  })),
);
