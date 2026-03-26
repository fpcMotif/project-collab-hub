import { describe, expect, it, mock } from "bun:test";

import type * as lark from "@larksuiteoapi/node-sdk";
import { Effect, Layer } from "effect";

import { FeishuAuthService } from "./feishu-auth-service.js";
import {
  FeishuWorkflowService,
  FeishuWorkflowServiceLive,
} from "./feishu-workflow-service.js";

const createTestLayer = ({
  instanceCreate = mock().mockResolvedValue({
    code: 0,
    data: { instance_code: "inst-1" },
  }),
  instanceGet = mock().mockResolvedValue({
    code: 0,
    data: {
      approval_code: "ap1",
      instance_code: "inst-1",
      status: "APPROVED",
      timeline: [],
    },
  }),
  taskApprove = mock().mockResolvedValue({ code: 0, data: {} }),
  taskReject = mock().mockResolvedValue({ code: 0, data: {} }),
}: {
  readonly instanceCreate?: ReturnType<typeof mock>;
  readonly instanceGet?: ReturnType<typeof mock>;
  readonly taskApprove?: ReturnType<typeof mock>;
  readonly taskReject?: ReturnType<typeof mock>;
} = {}) => {
  const client = {
    approval: {
      instance: {
        create: instanceCreate,
        get: instanceGet,
      },
      task: {
        approve: taskApprove,
        reject: taskReject,
      },
    },
  } as unknown as lark.Client;

  return Layer.provide(
    FeishuWorkflowServiceLive,
    Layer.succeed(FeishuAuthService, {
      client,
      getTenantAccessToken: () => Effect.succeed("token"),
    })
  );
};

describe("FeishuWorkflowService", () => {
  it("triggerWorkflow returns instance code", async () => {
    const layer = createTestLayer();
    const result = await Effect.runPromise(
      FeishuWorkflowService.pipe(
        Effect.andThen((s) =>
          s.triggerWorkflow({
            approvalCode: "code",
            formData: "[]",
            openId: "ou",
          })
        ),
        Effect.provide(layer)
      )
    );
    expect(result.instanceCode).toBe("inst-1");
  });

  it("triggerWorkflow fails when instance_code is missing", async () => {
    const instanceCreate = mock().mockResolvedValue({
      code: 0,
      data: {},
    });
    const layer = createTestLayer({ instanceCreate });

    await expect(
      Effect.runPromise(
        FeishuWorkflowService.pipe(
          Effect.andThen((s) =>
            s.triggerWorkflow({
              approvalCode: "code",
              formData: "[]",
              openId: "ou",
            })
          ),
          Effect.provide(layer)
        )
      )
    ).rejects.toThrow("No instance_code in workflow response");
  });

  it("triggerWorkflow fails on non-zero code even with partial data", async () => {
    const instanceCreate = mock().mockResolvedValue({
      code: 403,
      data: { instance_code: "inst-bad" },
      msg: "permission denied",
    });
    const layer = createTestLayer({ instanceCreate });

    await expect(
      Effect.runPromise(
        FeishuWorkflowService.pipe(
          Effect.andThen((s) =>
            s.triggerWorkflow({
              approvalCode: "code",
              formData: "[]",
              openId: "ou",
            })
          ),
          Effect.provide(layer)
        )
      )
    ).rejects.toThrow("Feishu API failed with code 403: permission denied");
  });

  it("getWorkflowInstance maps detail fields", async () => {
    const layer = createTestLayer();
    const detail = await Effect.runPromise(
      FeishuWorkflowService.pipe(
        Effect.andThen((s) => s.getWorkflowInstance({ instanceId: "inst-1" })),
        Effect.provide(layer)
      )
    );
    expect(detail.instanceCode).toBe("inst-1");
    expect(detail.approvalCode).toBe("ap1");
    expect(detail.status).toBe("APPROVED");
  });

  it("getWorkflowInstance fails when data is missing", async () => {
    const instanceGet = mock().mockResolvedValue({ code: 0, data: undefined });
    const layer = createTestLayer({ instanceGet });

    await expect(
      Effect.runPromise(
        FeishuWorkflowService.pipe(
          Effect.andThen((s) => s.getWorkflowInstance({ instanceId: "x" })),
          Effect.provide(layer)
        )
      )
    ).rejects.toThrow("No data in response");
  });

  it("getWorkflowInstance fails on non-zero code even with partial data", async () => {
    const instanceGet = mock().mockResolvedValue({
      code: 99_999,
      data: { status: "APPROVED" },
      msg: "rate limited",
    });
    const layer = createTestLayer({ instanceGet });

    await expect(
      Effect.runPromise(
        FeishuWorkflowService.pipe(
          Effect.andThen((s) => s.getWorkflowInstance({ instanceId: "x" })),
          Effect.provide(layer)
        )
      )
    ).rejects.toThrow("Feishu API failed with code 99999: rate limited");
  });

  it("respondToNode calls task.approve with instance approval_code", async () => {
    const taskApprove = mock().mockResolvedValue({ code: 0, data: {} });
    const layer = createTestLayer({ taskApprove });

    await Effect.runPromise(
      FeishuWorkflowService.pipe(
        Effect.andThen((s) =>
          s.respondToNode({
            action: "approve",
            instanceId: "inst-1",
            nodeId: "task-node-1",
            userId: "u1",
          })
        ),
        Effect.provide(layer)
      )
    );

    expect(taskApprove).toHaveBeenCalledWith({
      data: {
        approval_code: "ap1",
        comment: "",
        instance_code: "inst-1",
        task_id: "task-node-1",
        user_id: "u1",
      },
    });
  });

  it("respondToNode calls task.reject when action is reject", async () => {
    const taskReject = mock().mockResolvedValue({ code: 0, data: {} });
    const layer = createTestLayer({ taskReject });

    await Effect.runPromise(
      FeishuWorkflowService.pipe(
        Effect.andThen((s) =>
          s.respondToNode({
            action: "reject",
            comment: "no",
            instanceId: "inst-1",
            nodeId: "task-node-1",
            userId: "u1",
          })
        ),
        Effect.provide(layer)
      )
    );

    expect(taskReject).toHaveBeenCalledWith({
      data: {
        approval_code: "ap1",
        comment: "no",
        instance_code: "inst-1",
        task_id: "task-node-1",
        user_id: "u1",
      },
    });
  });

  it("respondToNode fails when instance has no approval_code", async () => {
    const instanceGet = mock().mockResolvedValue({
      code: 0,
      data: { instance_code: "inst-1" },
    });
    const layer = createTestLayer({ instanceGet });

    await expect(
      Effect.runPromise(
        FeishuWorkflowService.pipe(
          Effect.andThen((s) =>
            s.respondToNode({
              action: "approve",
              instanceId: "i",
              nodeId: "n",
              userId: "u",
            })
          ),
          Effect.provide(layer)
        )
      )
    ).rejects.toThrow("No approval_code on approval instance");
  });

  it("respondToNode fails when task.approve returns non-zero code", async () => {
    const taskApprove = mock().mockResolvedValue({
      code: 1,
      msg: "nope",
    });
    const layer = createTestLayer({ taskApprove });

    await expect(
      Effect.runPromise(
        FeishuWorkflowService.pipe(
          Effect.andThen((s) =>
            s.respondToNode({
              action: "approve",
              instanceId: "inst-1",
              nodeId: "n",
              userId: "u",
            })
          ),
          Effect.provide(layer)
        )
      )
    ).rejects.toThrow(/Feishu API failed/);
  });
});
