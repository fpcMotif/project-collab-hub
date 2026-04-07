import { Context, Effect, Layer } from "effect";

import { FeishuError } from "../errors/feishu-error.js";
import { FeishuAuthService } from "./feishu-auth-service.js";
import { getFeishuData, wrapFeishuError } from "./feishu-response.js";

export interface GetUserParams {
  readonly userId: string;
  readonly userIdType?: "user_id" | "union_id" | "open_id";
}

export interface UserResult {
  readonly userId: string;
  readonly name: string;
  readonly enName?: string;
  readonly email?: string;
  readonly mobile?: string;
  readonly avatarUrl?: string;
}

export class FeishuUserService extends Context.Tag("FeishuUserService")<
  FeishuUserService,
  {
    readonly getUser: (
      params: GetUserParams
    ) => Effect.Effect<UserResult, FeishuError>;
  }
>() {}

export const FeishuUserServiceLive = Layer.effect(
  FeishuUserService,
  FeishuAuthService.pipe(
    Effect.map((auth) => ({
      getUser: (params: GetUserParams) =>
        Effect.tryPromise({
          catch: (error) => wrapFeishuError("Failed to get User record", error),
          try: async () => {
            const response = await auth.client.contact.v3.user.get({
              params: {
                user_id_type: params.userIdType ?? "user_id",
              },
              path: {
                user_id: params.userId,
              },
            });

            const data = getFeishuData(response) as {
              user?: {
                user_id?: string;
                open_id?: string;
                union_id?: string;
                name?: string;
                en_name?: string;
                email?: string;
                mobile?: string;
                avatar?: {
                  avatar_72?: string;
                  avatar_240?: string;
                  avatar_640?: string;
                  avatar_origin?: string;
                };
              };
            };

            const { user } = data;
            if (!user) {
              throw new FeishuError({ message: "No user in response" });
            }

            return {
              avatarUrl:
                user.avatar?.avatar_origin ||
                user.avatar?.avatar_640 ||
                user.avatar?.avatar_240 ||
                user.avatar?.avatar_72,
              email: user.email,
              enName: user.en_name,
              mobile: user.mobile,
              name: user.name ?? "Unknown",
              userId: user.user_id || user.open_id || params.userId,
            };
          },
        }),
    }))
  )
);
