import { Context, Effect, Layer } from "effect";
import * as lark from "@larksuiteoapi/node-sdk";
import { FeishuError } from "../errors/FeishuError.js";

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
        try: async () => {
          const resp = await fetch(
            "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                app_id: config.appId,
                app_secret: config.appSecret,
              }),
            },
          );
          const data = (await resp.json()) as {
            tenant_access_token: string;
            code: number;
            msg: string;
          };
          if (data.code !== 0) {
            throw new FeishuError({ message: `Feishu auth failed: ${data.msg}` });
          }
          return data.tenant_access_token;
        },
        catch: (error) =>
          new FeishuError({ message: `Failed to get tenant access token: ${error instanceof Error ? error.message : String(error)}` }),
      }),
  });
