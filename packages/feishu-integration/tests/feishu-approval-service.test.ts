import { describe, expect, it } from "bun:test";
import { Effect, Layer } from "effect";
import {
  FeishuApprovalService,
  FeishuApprovalServiceLive,
} from "../src/services/FeishuApprovalService.js";
import { FeishuAuthService } from "../src/services/FeishuAuthService.js";

describe("FeishuApprovalServiceLive", () => {
  it("should throw an error when instance_code is missing in response", async () => {
    // Create a mock auth service returning no instance_code
    const mockAuthService = Layer.succeed(FeishuAuthService, {
      client: {
        approval: {
          instance: {
            create: async () => {
              return {
                data: {
                  // explicitly no instance_code
                },
              };
            },
          },
        },
      } as any,
      getTenantAccessToken: () => Effect.succeed("mock_token"),
    });

    // We can also test if it throws correctly when data is undefined
    const testLayer = Layer.provide(FeishuApprovalServiceLive, mockAuthService);

    const program = Effect.gen(function* () {
      const approvalService = yield* FeishuApprovalService;
      return yield* approvalService.createInstance({
        approvalCode: "test-code",
        applicantId: "test-id",
        formData: "{}",
      });
    });

    const result = await Effect.runPromiseExit(
      Effect.provide(program, testLayer),
    );

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = result.cause;
      expect(error.toString()).toContain("No instance_code in response");
    }
  });

  it("should throw an error when data itself is undefined", async () => {
    // Create a mock auth service returning no data at all
    const mockAuthService = Layer.succeed(FeishuAuthService, {
      client: {
        approval: {
          instance: {
            create: async () => {
              return {
                // explicitly no data
              };
            },
          },
        },
      } as any,
      getTenantAccessToken: () => Effect.succeed("mock_token"),
    });

    const testLayer = Layer.provide(FeishuApprovalServiceLive, mockAuthService);

    const program = Effect.gen(function* () {
      const approvalService = yield* FeishuApprovalService;
      return yield* approvalService.createInstance({
        approvalCode: "test-code",
        applicantId: "test-id",
        formData: "{}",
      });
    });

    const result = await Effect.runPromiseExit(
      Effect.provide(program, testLayer),
    );

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = result.cause;
      expect(error.toString()).toContain("No instance_code in response");
    }
  });

  it("should return instanceCode when creation succeeds", async () => {
    // Create a mock auth service returning valid instance_code
    const mockAuthService = Layer.succeed(FeishuAuthService, {
      client: {
        approval: {
          instance: {
            create: async () => {
              return {
                data: {
                  instance_code: "valid-instance-code",
                },
              };
            },
          },
        },
      } as any,
      getTenantAccessToken: () => Effect.succeed("mock_token"),
    });

    const testLayer = Layer.provide(FeishuApprovalServiceLive, mockAuthService);

    const program = Effect.gen(function* () {
      const approvalService = yield* FeishuApprovalService;
      return yield* approvalService.createInstance({
        approvalCode: "test-code",
        applicantId: "test-id",
        formData: "{}",
      });
    });

    const result = await Effect.runPromiseExit(
      Effect.provide(program, testLayer),
    );

    expect(result._tag).toBe("Success");
    if (result._tag === "Success") {
      expect(result.value).toEqual({ instanceCode: "valid-instance-code" });
    }
  });
});
