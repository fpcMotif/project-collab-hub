import { describe, expect, it, vi, beforeEach } from "vitest";

// Set up mocks before imports
vi.mock("../convex/lib/feishu-maps", () => ({
  mapFeishuApprovalStatus: vi.fn(),
  mapFeishuTaskToWorkItemStatus: vi.fn((s) =>
    s === "DONE" ? "done" : "in_progress"
  ),
  mapFeishuWorkflowStatus: vi.fn(),
}));

vi.mock("../convex/lib/feishu-http-utils", () => ({
  extractBaseRecordIdFromEvent: vi.fn(),
  isValidConvexWorkItemId: vi.fn(),
  verifySignature: vi.fn().mockResolvedValue(true),
}));

vi.mock("../convex/_generated/api", () => ({
  anyApi: {},
  api: {
    feishuTaskBindings: {
      applyTaskEvent: "api.feishuTaskBindings.applyTaskEvent",
      getByTaskGuid: "api.feishuTaskBindings.getByTaskGuid",
    },
  },
  internal: {},
}));

vi.mock("../convex/_generated/server", () => ({
  httpAction: (handler: unknown) => handler,
  internalAction: vi.fn(),
  internalMutation: vi.fn(),
  internalQuery: vi.fn(),
}));

// Provide a mock http handler setup
const mockRoute = vi.fn();
vi.mock("convex/server", () => ({
  anyApi: {
    approvalGates: { resolve: "anyApi.approvalGates.resolve" },
    baseBindings: { getByRecordId: "anyApi.baseBindings.getByRecordId" },
    chatBindings: { getByProjectId: "anyApi.chatBindings.getByProjectId" },
    projects: { getById: "anyApi.projects.getById" },
    workflowInstances: {
      getByInstanceCode: "anyApi.workflowInstances.getByInstanceCode",
      updateStatus: "anyApi.workflowInstances.updateStatus",
    },
  },
  httpRouter: () => ({
    lookup: vi.fn(),
    route: mockRoute,
  }),
}));

describe("feishu/events task handling", () => {
  let eventsRouteHandler: (ctx: unknown, request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Dynamically import to ensure mockRoute is populated during execution
    await import("../convex/http");

    const { calls } = mockRoute.mock;
    const feishuEventRoute = calls.find(
      (call) => call[0].path === "/feishu/events" && call[0].method === "POST"
    );

    if (feishuEventRoute) {
      eventsRouteHandler = feishuEventRoute[0].handler;
    }
  });

  it("handles task.updated event successfully", async () => {
    expect(eventsRouteHandler).toBeDefined();

    const mockRunQuery = vi.fn().mockResolvedValue({ _id: "binding-id" });
    const mockRunMutation = vi.fn().mockResolvedValue(null);

    const mockCtx = {
      runMutation: mockRunMutation,
      runQuery: mockRunQuery,
    };

    const payload = {
      event: {
        status: "DONE",
        task_id: "tguid_abc",
      },
      header: {
        event_id: "evt_123",
        event_type: "task.updated",
      },
    };

    const mockRequest = new Request("https://example.com/feishu/events", {
      body: JSON.stringify(payload),
      method: "POST",
    });

    const response = await eventsRouteHandler(mockCtx, mockRequest);

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);

    expect(mockRunQuery).toHaveBeenCalledWith(
      "api.feishuTaskBindings.getByTaskGuid",
      {
        feishuTaskGuid: "tguid_abc",
      }
    );

    // Derived from mocked mapFeishuTaskToWorkItemStatus
    expect(mockRunMutation).toHaveBeenCalledWith(
      "api.feishuTaskBindings.applyTaskEvent",
      {
        feishuTaskGuid: "tguid_abc",
        feishuTaskStatus: "DONE",
        idempotencyKey: "evt_123",
        workItemStatus: "done",
      }
    );
  });

  it("ignores task without taskGuid", async () => {
    const mockRunQuery = vi.fn();
    const mockRunMutation = vi.fn();

    const payload = {
      event: {
        // missing task_id
      },
      header: {
        event_id: "evt_456",
        event_type: "task.updated",
      },
    };

    const response = await eventsRouteHandler(
      { runMutation: mockRunMutation, runQuery: mockRunQuery },
      new Request("http://localhost", {
        body: JSON.stringify(payload),
        method: "POST",
      })
    );
    expect(response.status).toBe(200);

    expect(mockRunQuery).not.toHaveBeenCalled();
    expect(mockRunMutation).not.toHaveBeenCalled();
  });

  it("ignores task event if binding does not exist", async () => {
    // Binding not found
    const mockRunQuery = vi.fn().mockResolvedValue(null);
    const mockRunMutation = vi.fn();

    const payload = {
      event: { task_id: "tguid_xyz" },
      header: { event_id: "evt_789", event_type: "task.updated" },
    };

    await eventsRouteHandler(
      { runMutation: mockRunMutation, runQuery: mockRunQuery },
      new Request("http://localhost", {
        body: JSON.stringify(payload),
        method: "POST",
      })
    );

    expect(mockRunQuery).toHaveBeenCalled();
    expect(mockRunMutation).not.toHaveBeenCalled();
  });
});
