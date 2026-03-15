import { describe, expect, it, mock } from "bun:test";
import { Effect, Layer } from "effect";
import { FeishuApprovalService, FeishuApprovalServiceLive } from "../FeishuApprovalService.js";
import { FeishuAuthService } from "../FeishuAuthService.js";

describe("FeishuApprovalService", () => {
  describe("createInstance", () => {
    it("should successfully create an approval instance", async () => {
      // Create a mock for the Feishu client
      const mockCreate = mock().mockResolvedValue({
        data: {
          instance_code: "test_instance_code",
        },
      });

      // Provide the mock implementation via a Layer
      const MockAuthServiceLive = Layer.succeed(FeishuAuthService, {
        client: {
          approval: {
            instance: {
              create: mockCreate,
            },
          },
        } as any,
        getTenantAccessToken: () => Effect.succeed("mock_token"),
      });

      const params = {
        approvalCode: "test_approval_code",
        applicantId: "test_applicant_id",
        formData: "{\"key\":\"value\"}",
      };

      const program = Effect.gen(function* () {
        const service = yield* FeishuApprovalService;
        return yield* service.createInstance(params);
      });

      const runnable = Effect.provide(
        program,
        Layer.provideMerge(FeishuApprovalServiceLive, MockAuthServiceLive)
      );

      const result = await Effect.runPromise(runnable);

      expect(result).toEqual({ instanceCode: "test_instance_code" });
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          approval_code: params.approvalCode,
          open_id: params.applicantId,
          form: params.formData,
        },
      });
    });

    it("should handle API failure gracefully", async () => {
      const mockCreate = mock().mockRejectedValue(new Error("API Error"));

      const MockAuthServiceLive = Layer.succeed(FeishuAuthService, {
        client: {
          approval: {
            instance: {
              create: mockCreate,
            },
          },
        } as any,
        getTenantAccessToken: () => Effect.succeed("mock_token"),
      });

      const program = Effect.gen(function* () {
        const service = yield* FeishuApprovalService;
        return yield* service.createInstance({
          approvalCode: "code",
          applicantId: "id",
          formData: "{}",
        });
      });

      const runnable = Effect.provide(
        program,
        Layer.provideMerge(FeishuApprovalServiceLive, MockAuthServiceLive)
      );

      const result = await Effect.runPromiseExit(runnable);

      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure") {
        const cause = result.cause;
        expect(cause._tag).toBe("Fail");
        if (cause._tag === "Fail") {
           expect((cause.error as Error).message).toContain("Failed to create approval instance");
        }
      }
    });

    it("should throw error if instance_code is missing in response", async () => {
      const mockCreate = mock().mockResolvedValue({
        data: {}, // Missing instance_code
      });

      const MockAuthServiceLive = Layer.succeed(FeishuAuthService, {
        client: {
          approval: {
            instance: {
              create: mockCreate,
            },
          },
        } as any,
        getTenantAccessToken: () => Effect.succeed("mock_token"),
      });

      const program = Effect.gen(function* () {
        const service = yield* FeishuApprovalService;
        return yield* service.createInstance({
          approvalCode: "code",
          applicantId: "id",
          formData: "{}",
        });
      });

      const runnable = Effect.provide(
        program,
        Layer.provideMerge(FeishuApprovalServiceLive, MockAuthServiceLive)
      );

      const result = await Effect.runPromiseExit(runnable);

      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure") {
        const cause = result.cause;
        expect(cause._tag).toBe("Fail");
        if (cause._tag === "Fail") {
           expect((cause.error as Error).message).toContain("No instance_code in response");
        }
      }
    });
  });

  describe("getInstance", () => {
    it("should successfully get an approval instance", async () => {
      const mockGet = mock().mockResolvedValue({
        data: {
          status: "APPROVED",
        },
      });

      const MockAuthServiceLive = Layer.succeed(FeishuAuthService, {
        client: {
          approval: {
            instance: {
              get: mockGet,
            },
          },
        } as any,
        getTenantAccessToken: () => Effect.succeed("mock_token"),
      });

      const program = Effect.gen(function* () {
        const service = yield* FeishuApprovalService;
        return yield* service.getInstance("test_instance_code");
      });

      const runnable = Effect.provide(
        program,
        Layer.provideMerge(FeishuApprovalServiceLive, MockAuthServiceLive)
      );

      const result = await Effect.runPromise(runnable);

      expect(result).toEqual({ status: "APPROVED" });
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockGet).toHaveBeenCalledWith({
        path: { instance_id: "test_instance_code" },
      });
    });

    it("should handle missing data gracefully", async () => {
      const mockGet = mock().mockResolvedValue({}); // Missing data

      const MockAuthServiceLive = Layer.succeed(FeishuAuthService, {
        client: {
          approval: {
            instance: {
              get: mockGet,
            },
          },
        } as any,
        getTenantAccessToken: () => Effect.succeed("mock_token"),
      });

      const program = Effect.gen(function* () {
        const service = yield* FeishuApprovalService;
        return yield* service.getInstance("test_instance_code");
      });

      const runnable = Effect.provide(
        program,
        Layer.provideMerge(FeishuApprovalServiceLive, MockAuthServiceLive)
      );

      const result = await Effect.runPromise(runnable);

      expect(result).toEqual({});
    });

    it("should handle get API failure gracefully", async () => {
      const mockGet = mock().mockRejectedValue(new Error("API Error"));

      const MockAuthServiceLive = Layer.succeed(FeishuAuthService, {
        client: {
          approval: {
            instance: {
              get: mockGet,
            },
          },
        } as any,
        getTenantAccessToken: () => Effect.succeed("mock_token"),
      });

      const program = Effect.gen(function* () {
        const service = yield* FeishuApprovalService;
        return yield* service.getInstance("test_instance_code");
      });

      const runnable = Effect.provide(
        program,
        Layer.provideMerge(FeishuApprovalServiceLive, MockAuthServiceLive)
      );

      const result = await Effect.runPromiseExit(runnable);

      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure") {
        const cause = result.cause;
        expect(cause._tag).toBe("Fail");
        if (cause._tag === "Fail") {
           expect((cause.error as Error).message).toContain("Failed to get approval instance");
        }
      }
    });
  });
});
