import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { Effect, Context } from "effect";
import { FeishuAuthService, FeishuAuthServiceLive } from "./FeishuAuthService";

const mockConfig = {
  appId: "mock-app-id",
  appSecret: "mock-app-secret",
};

describe("FeishuAuthService", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.restore();
  });

  it("should return tenant access token when auth succeeds (code === 0)", async () => {
    const mockFetch = mock(async () => {
      return new Response(
        JSON.stringify({
          code: 0,
          msg: "ok",
          tenant_access_token: "mock-access-token",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }) as unknown as typeof fetch;
    globalThis.fetch = mockFetch;

    const program = Effect.gen(function* (_) {
      const authService = yield* _(FeishuAuthService);
      return yield* _(authService.getTenantAccessToken());
    }).pipe(Effect.provide(FeishuAuthServiceLive(mockConfig)));

    const token = await Effect.runPromise(program);
    expect(token).toBe("mock-access-token");
  });

  it("should throw an error when auth fails (code !== 0)", async () => {
    const mockFetch = mock(async () => {
      return new Response(
        JSON.stringify({
          code: 10000,
          msg: "Invalid config",
          tenant_access_token: "",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }) as unknown as typeof fetch;
    globalThis.fetch = mockFetch;

    const program = Effect.gen(function* (_) {
      const authService = yield* _(FeishuAuthService);
      return yield* _(authService.getTenantAccessToken());
    }).pipe(Effect.provide(FeishuAuthServiceLive(mockConfig)));

    const promise = Effect.runPromise(program);
    expect(promise).rejects.toThrow("Failed to get tenant access token: Feishu auth failed: Invalid config");
  });

  it("should handle network errors", async () => {
    const mockFetch = mock(async () => {
      throw new Error("Network offline");
    }) as unknown as typeof fetch;
    globalThis.fetch = mockFetch;

    const program = Effect.gen(function* (_) {
      const authService = yield* _(FeishuAuthService);
      return yield* _(authService.getTenantAccessToken());
    }).pipe(Effect.provide(FeishuAuthServiceLive(mockConfig)));

    const promise = Effect.runPromise(program);
    expect(promise).rejects.toThrow("Failed to get tenant access token: Network offline");
  });
});
