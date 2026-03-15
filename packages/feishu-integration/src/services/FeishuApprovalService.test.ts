import { describe, it, expect, vi } from "vitest";
import { Effect, Layer } from "effect";
import {
  FeishuApprovalServiceLive,
  FeishuApprovalService,
} from "./FeishuApprovalService.js";
import { FeishuAuthService } from "./FeishuAuthService.js";

describe("FeishuApprovalService", () => {
  it("should handle error when createInstance throws", async () => {
    const mockAuthService = {
      client: {
        approval: {
          instance: {
            create: vi.fn().mockRejectedValue(new Error("Network Error")),
          },
        },
      },
      getTenantAccessToken: vi.fn(),
    } as unknown as { readonly client: any; readonly getTenantAccessToken: () => any; };

    const mockAuthLayer = Layer.succeed(FeishuAuthService, mockAuthService);
    const approvalLayer = FeishuApprovalServiceLive.pipe(Layer.provide(mockAuthLayer));

    const program = Effect.gen(function* () {
      const approvalService = yield* FeishuApprovalService;
      return yield* approvalService.createInstance({
        approvalCode: "123",
        applicantId: "user_1",
        formData: "{}",
      });
    }).pipe(Effect.provide(approvalLayer));

    const result = await Effect.runPromiseExit(program);

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect(result.cause._tag).toBe("Fail");
      if (result.cause._tag === "Fail") {
        expect(result.cause.error).toBeInstanceOf(Error);
        expect((result.cause.error as Error).message).toBe(
          "Failed to create approval instance: Network Error",
        );
      }
    }
  });

  it("should handle non-Error throw in createInstance", async () => {
    const mockAuthService = {
      client: {
        approval: {
          instance: {
            create: vi.fn().mockRejectedValue("String error"),
          },
        },
      },
      getTenantAccessToken: vi.fn(),
    } as unknown as { readonly client: any; readonly getTenantAccessToken: () => any; };

    const mockAuthLayer = Layer.succeed(FeishuAuthService, mockAuthService);
    const approvalLayer = FeishuApprovalServiceLive.pipe(Layer.provide(mockAuthLayer));

    const program = Effect.gen(function* () {
      const approvalService = yield* FeishuApprovalService;
      return yield* approvalService.createInstance({
        approvalCode: "123",
        applicantId: "user_1",
        formData: "{}",
      });
    }).pipe(Effect.provide(approvalLayer));

    const result = await Effect.runPromiseExit(program);

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect(result.cause._tag).toBe("Fail");
      if (result.cause._tag === "Fail") {
        expect(result.cause.error).toBeInstanceOf(Error);
        expect((result.cause.error as Error).message).toBe(
          "Failed to create approval instance: String error",
        );
      }
    }
  });

  it("should handle error when getInstance throws", async () => {
    const mockAuthService = {
      client: {
        approval: {
          instance: {
            get: vi.fn().mockRejectedValue(new Error("Not Found")),
          },
        },
      },
      getTenantAccessToken: vi.fn(),
    } as unknown as { readonly client: any; readonly getTenantAccessToken: () => any; };

    const mockAuthLayer = Layer.succeed(FeishuAuthService, mockAuthService);
    const approvalLayer = FeishuApprovalServiceLive.pipe(Layer.provide(mockAuthLayer));

    const program = Effect.gen(function* () {
      const approvalService = yield* FeishuApprovalService;
      return yield* approvalService.getInstance("inst_123");
    }).pipe(Effect.provide(approvalLayer));

    const result = await Effect.runPromiseExit(program);

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect(result.cause._tag).toBe("Fail");
      if (result.cause._tag === "Fail") {
        expect(result.cause.error).toBeInstanceOf(Error);
        expect((result.cause.error as Error).message).toBe(
          "Failed to get approval instance: Not Found",
        );
      }
    }
  });

  it("should handle non-Error throw in getInstance", async () => {
    const mockAuthService = {
      client: {
        approval: {
          instance: {
            get: vi.fn().mockRejectedValue("String error getting"),
          },
        },
      },
      getTenantAccessToken: vi.fn(),
    } as unknown as { readonly client: any; readonly getTenantAccessToken: () => any; };

    const mockAuthLayer = Layer.succeed(FeishuAuthService, mockAuthService);
    const approvalLayer = FeishuApprovalServiceLive.pipe(Layer.provide(mockAuthLayer));

    const program = Effect.gen(function* () {
      const approvalService = yield* FeishuApprovalService;
      return yield* approvalService.getInstance("inst_123");
    }).pipe(Effect.provide(approvalLayer));

    const result = await Effect.runPromiseExit(program);

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect(result.cause._tag).toBe("Fail");
      if (result.cause._tag === "Fail") {
        expect(result.cause.error).toBeInstanceOf(Error);
        expect((result.cause.error as Error).message).toBe(
          "Failed to get approval instance: String error getting",
        );
      }
    }
  });

  it("should return instanceCode successfully in createInstance", async () => {
    const mockAuthService = {
      client: {
        approval: {
          instance: {
            create: vi.fn().mockResolvedValue({
              data: { instance_code: "success_inst_123" },
            }),
          },
        },
      },
      getTenantAccessToken: vi.fn(),
    } as unknown as { readonly client: any; readonly getTenantAccessToken: () => any; };

    const mockAuthLayer = Layer.succeed(FeishuAuthService, mockAuthService);
    const approvalLayer = FeishuApprovalServiceLive.pipe(Layer.provide(mockAuthLayer));

    const program = Effect.gen(function* () {
      const approvalService = yield* FeishuApprovalService;
      return yield* approvalService.createInstance({
        approvalCode: "123",
        applicantId: "user_1",
        formData: "{}",
      });
    }).pipe(Effect.provide(approvalLayer));

    const result = await Effect.runPromise(program);
    expect(result).toEqual({ instanceCode: "success_inst_123" });
  });

  it("should throw error if no instance_code returned in createInstance", async () => {
    const mockAuthService = {
      client: {
        approval: {
          instance: {
            create: vi.fn().mockResolvedValue({
              data: {},
            }),
          },
        },
      },
      getTenantAccessToken: vi.fn(),
    } as unknown as { readonly client: any; readonly getTenantAccessToken: () => any; };

    const mockAuthLayer = Layer.succeed(FeishuAuthService, mockAuthService);
    const approvalLayer = FeishuApprovalServiceLive.pipe(Layer.provide(mockAuthLayer));

    const program = Effect.gen(function* () {
      const approvalService = yield* FeishuApprovalService;
      return yield* approvalService.createInstance({
        approvalCode: "123",
        applicantId: "user_1",
        formData: "{}",
      });
    }).pipe(Effect.provide(approvalLayer));

    const result = await Effect.runPromiseExit(program);

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect(result.cause._tag).toBe("Fail");
      if (result.cause._tag === "Fail") {
        expect(result.cause.error).toBeInstanceOf(Error);
        expect((result.cause.error as Error).message).toBe(
          "Failed to create approval instance: No instance_code in response",
        );
      }
    }
  });

  it("should return instance successfully in getInstance", async () => {
    const mockAuthService = {
      client: {
        approval: {
          instance: {
            get: vi.fn().mockResolvedValue({
              data: { some_field: "some_value" },
            }),
          },
        },
      },
      getTenantAccessToken: vi.fn(),
    } as unknown as { readonly client: any; readonly getTenantAccessToken: () => any; };

    const mockAuthLayer = Layer.succeed(FeishuAuthService, mockAuthService);
    const approvalLayer = FeishuApprovalServiceLive.pipe(Layer.provide(mockAuthLayer));

    const program = Effect.gen(function* () {
      const approvalService = yield* FeishuApprovalService;
      return yield* approvalService.getInstance("inst_123");
    }).pipe(Effect.provide(approvalLayer));

    const result = await Effect.runPromise(program);
    expect(result).toEqual({ some_field: "some_value" });
  });

  it("should return empty object if no data in getInstance", async () => {
    const mockAuthService = {
      client: {
        approval: {
          instance: {
            get: vi.fn().mockResolvedValue({}),
          },
        },
      },
      getTenantAccessToken: vi.fn(),
    } as unknown as { readonly client: any; readonly getTenantAccessToken: () => any; };

    const mockAuthLayer = Layer.succeed(FeishuAuthService, mockAuthService);
    const approvalLayer = FeishuApprovalServiceLive.pipe(Layer.provide(mockAuthLayer));

    const program = Effect.gen(function* () {
      const approvalService = yield* FeishuApprovalService;
      return yield* approvalService.getInstance("inst_123");
    }).pipe(Effect.provide(approvalLayer));

    const result = await Effect.runPromise(program);
    expect(result).toEqual({});
  });
});
