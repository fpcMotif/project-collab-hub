import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { Effect, Layer } from "effect";

import { FeishuAuthService } from "./feishu-auth-service.js";
import {
  FeishuTaskService,
  FeishuTaskServiceLive,
} from "./feishu-task-service.js";

const createTaskParams = {
  description: "Test Description",
  dueTimestamp: "1678886400",
  memberIds: ["user-1", "user-2"],
  originHref: "https://example.com/task",
  originTitle: "Origin Title",
  summary: "Test Summary",
} as const;

let dateNowSpy: ReturnType<typeof spyOn> | undefined;

afterEach(() => {
  dateNowSpy?.mockRestore();
  dateNowSpy = undefined;
});

const createTestLayer = ({
  createRequest = mock().mockResolvedValue({
    code: 0,
    data: {
      task: {
        guid: "mock-task-guid-123",
      },
    },
  }),
  patchRequest = mock().mockResolvedValue({ code: 0, data: {} }),
  getRequest = mock().mockResolvedValue({
    code: 0,
    data: {
      guid: "mock-task-guid-123",
      summary: "Test Summary",
    },
  }),
}: {
  readonly createRequest?: ReturnType<typeof mock>;
  readonly patchRequest?: ReturnType<typeof mock>;
  readonly getRequest?: ReturnType<typeof mock>;
} = {}) =>
  Layer.provide(
    FeishuTaskServiceLive,
    Layer.succeed(FeishuAuthService, {
      client: {
        task: {
          v2: {
            task: {
              create: createRequest,
              get: getRequest,
              patch: patchRequest,
            },
          },
        },
      },
      getTenantAccessToken: () => Effect.succeed("mock-token"),
    } as unknown as FeishuAuthService)
  );

const runCreateTask = (testLayer: ReturnType<typeof createTestLayer>) =>
  Effect.runPromise(
    FeishuTaskService.pipe(
      Effect.andThen((service) => service.createTask(createTaskParams)),
      Effect.provide(testLayer)
    )
  );

const runCompleteTask = (testLayer: ReturnType<typeof createTestLayer>) =>
  Effect.runPromise(
    FeishuTaskService.pipe(
      Effect.andThen((service) => service.completeTask("mock-task-guid-123")),
      Effect.provide(testLayer)
    )
  );

const runUncompleteTask = (testLayer: ReturnType<typeof createTestLayer>) =>
  Effect.runPromise(
    FeishuTaskService.pipe(
      Effect.andThen((service) => service.uncompleteTask("mock-task-guid-123")),
      Effect.provide(testLayer)
    )
  );

const runGetTask = (testLayer: ReturnType<typeof createTestLayer>) =>
  Effect.runPromise(
    FeishuTaskService.pipe(
      Effect.andThen((service) => service.getTask("mock-task-guid-123")),
      Effect.provide(testLayer)
    )
  );

describe("FeishuTaskService", () => {
  describe("createTask", () => {
    it("creates a task and returns the task guid", async () => {
      const createRequest = mock().mockResolvedValue({
        code: 0,
        data: {
          task: {
            guid: "mock-task-guid-123",
          },
        },
      });
      const testLayer = createTestLayer({ createRequest });

      const result = await runCreateTask(testLayer);

      expect(result).toEqual({ taskGuid: "mock-task-guid-123" });
      expect(createRequest).toHaveBeenCalledTimes(1);
      expect(createRequest).toHaveBeenCalledWith({
        data: {
          description: "Test Description",
          due: {
            is_all_day: true,
            timestamp: "1678886400",
          },
          members: [
            { id: "user-1", role: "assignee", type: "user" },
            { id: "user-2", role: "assignee", type: "user" },
          ],
          origin: {
            href: { title: "Origin Title", url: "https://example.com/task" },
            platform_i18n_name: { en_us: "Project Collab Hub" },
          },
          summary: "Test Summary",
        },
      });
    });

    it("fails when the response is missing the task guid", async () => {
      const createRequest = mock().mockResolvedValue({
        code: 0,
        data: { task: {} },
      });
      const testLayer = createTestLayer({ createRequest });

      await expect(runCreateTask(testLayer)).rejects.toThrow(
        "Failed to create Feishu task: No task guid in response"
      );
    });

    it("fails when Feishu returns a non-zero code", async () => {
      const createRequest = mock().mockResolvedValue({
        code: 403,
        msg: "permission denied",
      });
      const testLayer = createTestLayer({ createRequest });

      await expect(runCreateTask(testLayer)).rejects.toThrow(
        "Failed to create Feishu task: Feishu API failed with code 403: permission denied"
      );
    });

    it("fails when the API call throws", async () => {
      const createRequest = mock().mockRejectedValue(new Error("API Error"));
      const testLayer = createTestLayer({ createRequest });

      await expect(runCreateTask(testLayer)).rejects.toThrow(
        "Failed to create Feishu task: API Error"
      );
    });
  });

  describe("completeTask", () => {
    it("completes a task with the expected payload", async () => {
      const patchRequest = mock().mockResolvedValue({ code: 0, data: {} });
      const testLayer = createTestLayer({ patchRequest });
      dateNowSpy = spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

      await expect(runCompleteTask(testLayer)).resolves.toBeUndefined();
      expect(patchRequest).toHaveBeenCalledWith({
        data: {
          task: { completed_at: "1700000000" },
          update_fields: ["completed_at"],
        },
        path: { task_guid: "mock-task-guid-123" },
      });
    });

    it("fails when Feishu rejects task completion", async () => {
      const patchRequest = mock().mockResolvedValue({
        code: 403,
        msg: "forbidden",
      });
      const testLayer = createTestLayer({ patchRequest });

      await expect(runCompleteTask(testLayer)).rejects.toThrow(
        "Failed to complete Feishu task: Feishu API failed with code 403: forbidden"
      );
    });
  });

  describe("uncompleteTask", () => {
    it("uncompletes a task with the expected payload", async () => {
      const patchRequest = mock().mockResolvedValue({ code: 0, data: {} });
      const testLayer = createTestLayer({ patchRequest });

      await expect(runUncompleteTask(testLayer)).resolves.toBeUndefined();
      expect(patchRequest).toHaveBeenCalledWith({
        data: {
          task: { completed_at: "0" },
          update_fields: ["completed_at"],
        },
        path: { task_guid: "mock-task-guid-123" },
      });
    });

    it("fails when Feishu rejects task uncompletion", async () => {
      const patchRequest = mock().mockResolvedValue({
        code: 403,
        msg: "forbidden",
      });
      const testLayer = createTestLayer({ patchRequest });

      await expect(runUncompleteTask(testLayer)).rejects.toThrow(
        "Failed to uncomplete Feishu task: Feishu API failed with code 403: forbidden"
      );
    });
  });

  describe("getTask", () => {
    it("returns the task data when Feishu succeeds", async () => {
      const getRequest = mock().mockResolvedValue({
        code: 0,
        data: { guid: "mock-task-guid-123", summary: "Test Summary" },
      });
      const testLayer = createTestLayer({ getRequest });

      await expect(runGetTask(testLayer)).resolves.toEqual({
        guid: "mock-task-guid-123",
        summary: "Test Summary",
      });
    });

    it("fails when Feishu returns a non-zero task response", async () => {
      const getRequest = mock().mockResolvedValue({
        code: 403,
        msg: "permission denied",
      });
      const testLayer = createTestLayer({ getRequest });

      await expect(runGetTask(testLayer)).rejects.toThrow(
        "Failed to get Feishu task: Feishu API failed with code 403: permission denied"
      );
    });

    it("fails when Feishu returns no task data", async () => {
      const getRequest = mock().mockResolvedValue({ code: 0 });
      const testLayer = createTestLayer({ getRequest });

      await expect(runGetTask(testLayer)).rejects.toThrow(
        "Failed to get Feishu task: No data in response"
      );
    });

    it("fails when Feishu returns non-object task data", async () => {
      const getRequest = mock().mockResolvedValue({ code: 0, data: "invalid" });
      const testLayer = createTestLayer({ getRequest });

      await expect(runGetTask(testLayer)).rejects.toThrow(
        "Failed to get Feishu task: Expected object data in response"
      );
    });
  });

  describe("updateTask", () => {
    it("updates a task with the expected payload", async () => {
      const patchRequest = mock().mockResolvedValue({ code: 0, data: {} });
      const testLayer = createTestLayer({ patchRequest });

      await Effect.runPromise(
        FeishuTaskService.pipe(
          Effect.andThen((service) =>
            service.updateTask({
              description: "Updated Description",
              summary: "Updated Summary",
              taskGuid: "mock-task-guid-123",
            })
          ),
          Effect.provide(testLayer)
        )
      );

      expect(patchRequest).toHaveBeenCalledWith({
        data: {
          task: {
            description: "Updated Description",
            summary: "Updated Summary",
          },
          update_fields: ["summary", "description"],
        },
        path: { task_guid: "mock-task-guid-123" },
      });
    });

    it("does nothing if no update fields are provided", async () => {
      const patchRequest = mock().mockResolvedValue({ code: 0, data: {} });
      const testLayer = createTestLayer({ patchRequest });

      await Effect.runPromise(
        FeishuTaskService.pipe(
          Effect.andThen((service) =>
            service.updateTask({
              taskGuid: "mock-task-guid-123",
            })
          ),
          Effect.provide(testLayer)
        )
      );

      expect(patchRequest).not.toHaveBeenCalled();
    });
  });
});
