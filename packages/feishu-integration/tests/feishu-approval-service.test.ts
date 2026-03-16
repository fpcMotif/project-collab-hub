import { describe, expect, it, mock } from "bun:test";

import { Effect, Layer } from "effect";

import {
  FeishuApprovalService,
  FeishuApprovalServiceLive,
} from "../src/services/feishu-approval-service.js";
import { FeishuAuthService } from "../src/services/feishu-auth-service.js";

const createApprovalParams = {
  applicantId: "test-id",
  approvalCode: "test-code",
  formData: "{}",
} as const;

const createTestLayer = ({
  createRequest = mock().mockResolvedValue({
    code: 0,
    data: { instance_code: "valid-instance-code" },
  }),
  getRequest = mock().mockResolvedValue({
    code: 0,
    data: { instance_code: "valid-instance-code", status: "APPROVED" },
  }),
}: {
  readonly createRequest?: ReturnType<typeof mock>;
  readonly getRequest?: ReturnType<typeof mock>;
} = {}) =>
  Layer.provide(
    FeishuApprovalServiceLive,
    Layer.succeed(FeishuAuthService, {
      client: {
        approval: {
          instance: {
            create: createRequest,
            get: getRequest,
          },
        },
      },
      getTenantAccessToken: () => Effect.succeed("mock_token"),
    } as unknown as FeishuAuthService)
  );

const runCreateInstance = (testLayer: ReturnType<typeof createTestLayer>) =>
  Effect.runPromise(
    FeishuApprovalService.pipe(
      Effect.andThen((service) => service.createInstance(createApprovalParams)),
      Effect.provide(testLayer)
    )
  );

const runGetInstance = (testLayer: ReturnType<typeof createTestLayer>) =>
  Effect.runPromise(
    FeishuApprovalService.pipe(
      Effect.andThen((service) => service.getInstance("valid-instance-code")),
      Effect.provide(testLayer)
    )
  );

describe("FeishuApprovalServiceLive", () => {
  it("returns the instance code when creation succeeds", async () => {
    const testLayer = createTestLayer();

    await expect(runCreateInstance(testLayer)).resolves.toEqual({
      instanceCode: "valid-instance-code",
    });
  });

  it("fails when the response is missing instance_code", async () => {
    const createRequest = mock().mockResolvedValue({
      code: 0,
      data: {},
    });
    const testLayer = createTestLayer({ createRequest });

    await expect(runCreateInstance(testLayer)).rejects.toThrow(
      "Failed to create approval instance: No instance_code in response"
    );
  });

  it("fails when Feishu returns a non-zero create response", async () => {
    const createRequest = mock().mockResolvedValue({
      code: 400,
      msg: "approval definition not found",
    });
    const testLayer = createTestLayer({ createRequest });

    await expect(runCreateInstance(testLayer)).rejects.toThrow(
      "Failed to create approval instance: Feishu API failed with code 400: approval definition not found"
    );
  });

  it("returns approval instance details when Feishu succeeds", async () => {
    const getRequest = mock().mockResolvedValue({
      code: 0,
      data: { instance_code: "valid-instance-code", status: "APPROVED" },
    });
    const testLayer = createTestLayer({ getRequest });

    await expect(runGetInstance(testLayer)).resolves.toEqual({
      instance_code: "valid-instance-code",
      status: "APPROVED",
    });
  });

  it("fails when Feishu returns a non-zero get response", async () => {
    const getRequest = mock().mockResolvedValue({
      code: 400,
      msg: "approval definition not found",
    });
    const testLayer = createTestLayer({ getRequest });

    await expect(runGetInstance(testLayer)).rejects.toThrow(
      "Failed to get approval instance: Feishu API failed with code 400: approval definition not found"
    );
  });

  it("fails when Feishu returns no approval instance data", async () => {
    const getRequest = mock().mockResolvedValue({ code: 0 });
    const testLayer = createTestLayer({ getRequest });

    await expect(runGetInstance(testLayer)).rejects.toThrow(
      "Failed to get approval instance: No data in response"
    );
  });

  it("fails when Feishu returns non-object approval instance data", async () => {
    const getRequest = mock().mockResolvedValue({ code: 0, data: ["invalid"] });
    const testLayer = createTestLayer({ getRequest });

    await expect(runGetInstance(testLayer)).rejects.toThrow(
      "Failed to get approval instance: Expected object data in response"
    );
  });
});
