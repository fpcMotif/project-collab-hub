import * as lark from "@larksuiteoapi/node-sdk";
import { Context, Effect, Layer } from "effect";

import { FeishuError } from "../errors/feishu-error.js";

export interface FeishuAuthConfig {
  readonly appId: string;
  readonly appSecret: string;
}

export class FeishuAuthService extends Context.Tag("FeishuAuthService")<
  FeishuAuthService,
  {
    readonly client: lark.Client;
    readonly getTenantAccessToken: () => Effect.Effect<string, FeishuError>;
  }
>() {}

export const FeishuAuthServiceLive = (config: FeishuAuthConfig) =>
  Layer.succeed(FeishuAuthService, {
    client: new lark.Client({
      appId: config.appId,
      appSecret: config.appSecret,
      appType: lark.AppType.SelfBuild,
    }),

    getTenantAccessToken: () =>
      Effect.tryPromise({
        catch: (error) =>
          new FeishuError({
            message: `Failed to get tenant access token: ${error instanceof Error ? error.message : String(error)}`,
          }),
        try: async () => {
          const resp = await fetch(
            "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
            {
              body: JSON.stringify({
                app_id: config.appId,
                app_secret: config.appSecret,
              }),
              headers: { "Content-Type": "application/json" },
              method: "POST",
            }
          );
          if (!resp.ok) {
            throw new FeishuError({
              message: `HTTP error! status: ${resp.status}`,
            });
          }
          const data = (await resp.json()) as {
            tenant_access_token: string;
            code: number;
            msg: string;
          };
          if (data.code !== 0) {
            throw new FeishuError({
              message: `Feishu auth failed: ${data.msg}`,
            });
          }
          return data.tenant_access_token;
        },
      }),
  });
