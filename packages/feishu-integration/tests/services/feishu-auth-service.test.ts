import { describe, it, expect, spyOn, afterEach } from "bun:test";
import { Effect } from "effect";
import { FeishuAuthService, FeishuAuthServiceLive } from "../../src/services/FeishuAuthService.js";

const config = {
  appId: "test-app-id",
  appSecret: "test-app-secret",
};

describe("FeishuAuthService", () => {
  afterEach(() => {
    // Restore global fetch after each test
    spyOn(global, "fetch").mockRestore();
  });

  it("should successfully get tenant access token", async () => {
    const mockResponse = {
      code: 0,
      msg: "ok",
      tenant_access_token: "t-123456",
    };

    spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify(mockResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }));

    const runnable = Effect.provide(
      Effect.flatMap(FeishuAuthService, (service) => service.getTenantAccessToken()),
      FeishuAuthServiceLive(config)
    );

    const token = await Effect.runPromise(runnable);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: config.appId,
          app_secret: config.appSecret,
        }),
      }
    );
    expect(token).toBe("t-123456");
  });

  it("should return an error when the API returns a non-zero code", async () => {
    const mockResponse = {
      code: 10000,
      msg: "Invalid AppId or AppSecret",
    };

    spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify(mockResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }));

    const runnable = Effect.provide(
      Effect.flatMap(FeishuAuthService, (service) => service.getTenantAccessToken()),
      FeishuAuthServiceLive(config)
    );

    await expect(Effect.runPromise(runnable)).rejects.toThrow("Failed to get tenant access token: Feishu auth failed: Invalid AppId or AppSecret");
  });

  it("should handle network errors", async () => {
    spyOn(global, "fetch").mockRejectedValue(new Error("Network Error"));

    const runnable = Effect.provide(
      Effect.flatMap(FeishuAuthService, (service) => service.getTenantAccessToken()),
      FeishuAuthServiceLive(config)
    );

    await expect(Effect.runPromise(runnable)).rejects.toThrow("Failed to get tenant access token: Network Error");
  });
});
