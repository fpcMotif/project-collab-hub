import { afterEach, describe, expect, it, spyOn } from "bun:test";

import { Effect } from "effect";

import {
  FeishuAuthService,
  FeishuAuthServiceLive,
} from "../../src/services/feishu-auth-service.js";

const config = {
  appId: "test-app-id",
  appSecret: "test-app-secret",
};

const makeRunnable = () =>
  FeishuAuthService.pipe(
    Effect.andThen((service) => service.getTenantAccessToken()),
    Effect.provide(FeishuAuthServiceLive(config))
  );

describe("FeishuAuthService", () => {
  afterEach(() => {
    spyOn(global, "fetch").mockRestore();
  });

  it("should successfully get tenant access token", async () => {
    const mockResponse = {
      code: 0,
      msg: "ok",
      tenant_access_token: "t-123456",
    };

    spyOn(global, "fetch").mockResolvedValue(Response.json(mockResponse));

    const token = await Effect.runPromise(makeRunnable());

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
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
    expect(token).toBe("t-123456");
  });

  it("should return an error when the API returns a non-zero code", async () => {
    const mockResponse = {
      code: 10_000,
      msg: "Invalid AppId or AppSecret",
    };

    spyOn(global, "fetch").mockResolvedValue(Response.json(mockResponse));

    await expect(Effect.runPromise(makeRunnable())).rejects.toThrow(
      "Failed to get tenant access token: Feishu auth failed: Invalid AppId or AppSecret"
    );
  });

  it("should handle network errors", async () => {
    spyOn(global, "fetch").mockRejectedValue(new Error("Network Error"));

    await expect(Effect.runPromise(makeRunnable())).rejects.toThrow(
      "Failed to get tenant access token: Network Error"
    );
  });
});
