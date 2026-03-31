import { describe, expect, it, mock } from "bun:test";

import { Effect, Either, Layer } from "effect";

import { FeishuError } from "../errors/feishu-error.js";
import {
  FeishuApprovalService,
  FeishuApprovalServiceLive,
} from "./feishu-approval-service.js";
import { FeishuAuthService } from "./feishu-auth-service.js";

const createTestLayer = (
  createInstanceMock: ReturnType<typeof mock>,
  getInstanceMock: ReturnType<typeof mock>
) =>
  FeishuApprovalServiceLive.pipe(
    Layer.provide(
      Layer.succeed(FeishuAuthService, {
        client: {
          approval: {
            instance: {
              create: createInstanceMock,
              get: getInstanceMock,
            },
          },
        },
      } as unknown as FeishuAuthService)
    )
  );

const runCreateInstanceEither = (
  testLayer: ReturnType<typeof createTestLayer>
) =>
  Effect.runPromise(
    FeishuApprovalService.pipe(
      Effect.andThen((service) =>
        service.createInstance({
          applicantId: "user-456",
          approvalCode: "app-123",
          formData: '{"field":"value"}',
        })
      ),
      Effect.provide(testLayer),
      Effect.either
    )
  );

const runGetInstanceEither = (testLayer: ReturnType<typeof createTestLayer>) =>
  Effect.runPromise(
    FeishuApprovalService.pipe(
      Effect.andThen((service) => service.getInstance("inst-789")),
      Effect.provide(testLayer),
      Effect.either
    )
  );

describe("FeishuApprovalService.createInstance", () => {
  it("creates an approval instance successfully", async () => {
    const createMock = mock().mockResolvedValue({
      code: 0,
      data: { instance_code: "inst-789" },
      msg: "success",
    });
    const getMock = mock();
    const testLayer = createTestLayer(createMock, getMock);

    const result = await runCreateInstanceEither(testLayer);

    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right).toEqual({ instanceCode: "inst-789" });
    }

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith({
      data: {
        approval_code: "app-123",
        form: '{"field":"value"}',
        open_id: "user-456",
      },
    });
  });

  it("fails when Feishu returns an error code", async () => {
    const createMock = mock().mockResolvedValue({
      code: 1000,
      msg: "invalid approval_code",
    });
    const getMock = mock();
    const testLayer = createTestLayer(createMock, getMock);

    const result = await runCreateInstanceEither(testLayer);

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(FeishuError);
      expect(result.left.message).toBe(
        "Failed to create approval instance: Feishu API failed with code 1000: invalid approval_code"
      );
    }
  });

  it("fails when response is missing instance_code", async () => {
    const createMock = mock().mockResolvedValue({
      code: 0,
      data: {},
      msg: "success", // missing instance_code
    });
    const getMock = mock();
    const testLayer = createTestLayer(createMock, getMock);

    const result = await runCreateInstanceEither(testLayer);

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(FeishuError);
      expect(result.left.message).toBe(
        "Failed to create approval instance: No instance_code in response"
      );
    }
  });

  it("fails on network error", async () => {
    const createMock = mock().mockRejectedValue(new Error("Network Error"));
    const getMock = mock();
    const testLayer = createTestLayer(createMock, getMock);

    const result = await runCreateInstanceEither(testLayer);

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(FeishuError);
      expect(result.left.message).toBe(
        "Failed to create approval instance: Network Error"
      );
    }
  });
});

describe("FeishuApprovalService.getInstance", () => {
  it("gets an approval instance successfully", async () => {
    const createMock = mock();
    const getMock = mock().mockResolvedValue({
      code: 0,
      data: {
        approval_code: "app-123",
        status: "APPROVED",
        form: '{"field":"value"}',
      },
      msg: "success",
    });
    const testLayer = createTestLayer(createMock, getMock);

    const result = await runGetInstanceEither(testLayer);

    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right).toEqual({
        approval_code: "app-123",
        form: '{"field":"value"}',
        status: "APPROVED",
      });
    }

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith({
      path: { instance_id: "inst-789" },
    });
  });

  it("fails when Feishu returns an error code", async () => {
    const createMock = mock();
    const getMock = mock().mockResolvedValue({
      code: 404,
      msg: "instance not found",
    });
    const testLayer = createTestLayer(createMock, getMock);

    const result = await runGetInstanceEither(testLayer);

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(FeishuError);
      expect(result.left.message).toBe(
        "Failed to get approval instance: Feishu API failed with code 404: instance not found"
      );
    }
  });

  it("fails on network error", async () => {
    const createMock = mock();
    const getMock = mock().mockRejectedValue(new Error("Network Error"));
    const testLayer = createTestLayer(createMock, getMock);

    const result = await runGetInstanceEither(testLayer);

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(FeishuError);
      expect(result.left.message).toBe(
        "Failed to get approval instance: Network Error"
      );
    }
  });
});
