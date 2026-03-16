import { describe, expect, it, mock } from "bun:test";
import { Effect, Layer } from "effect";
import { FeishuAuthService } from "./FeishuAuthService.js";
import { FeishuTaskService, FeishuTaskServiceLive } from "./FeishuTaskService.js";

describe("FeishuTaskService", () => {
  describe("createTask", () => {
    it("should successfully create a task and return the taskGuid", async () => {
      // Create a mock FeishuAuthService
      const mockCreate = mock().mockResolvedValue({
        data: {
          task: {
            guid: "mock-task-guid-123",
          },
        },
      });

      const mockAuthService = {
        client: {
          task: {
            v2: {
              task: {
                create: mockCreate,
              },
            },
          },
        },
        getTenantAccessToken: () => Effect.succeed("mock-token"),
      } as unknown as FeishuAuthService;

      // Provide the mock auth service to the layer
      const AuthLayer = Layer.succeed(FeishuAuthService, mockAuthService);
      const TestLayer = Layer.provide(FeishuTaskServiceLive, AuthLayer);

      // Call createTask via Effect.flatMap
      const program = Effect.flatMap(FeishuTaskService, (service) =>
        service.createTask({
          summary: "Test Summary",
          description: "Test Description",
          dueTimestamp: "1678886400",
          memberIds: ["user-1", "user-2"],
          originHref: "https://example.com/task",
          originTitle: "Origin Title",
        })
      );

      const result = await Effect.runPromise(Effect.provide(program, TestLayer));

      // Verify result
      expect(result).toEqual({ taskGuid: "mock-task-guid-123" });

      // Verify mock was called with correct parameters
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          summary: "Test Summary",
          description: "Test Description",
          due: {
            timestamp: "1678886400",
            is_all_day: true,
          },
          origin: {
            platform_i18n_name: { en_us: "Project Collab Hub" },
            href: { url: "https://example.com/task", title: "Origin Title" },
          },
          members: [
            { id: "user-1", type: "user", role: "assignee" },
            { id: "user-2", type: "user", role: "assignee" },
          ],
        },
      });
    });

    it("should throw an error if the response has no task guid", async () => {
      // Create a mock FeishuAuthService
      const mockCreate = mock().mockResolvedValue({
        data: {
          task: {
            // No guid
          },
        },
      });

      const mockAuthService = {
        client: {
          task: {
            v2: {
              task: {
                create: mockCreate,
              },
            },
          },
        },
        getTenantAccessToken: () => Effect.succeed("mock-token"),
      } as unknown as FeishuAuthService;

      // Provide the mock auth service to the layer
      const AuthLayer = Layer.succeed(FeishuAuthService, mockAuthService);
      const TestLayer = Layer.provide(FeishuTaskServiceLive, AuthLayer);

      // Call createTask
      const program = Effect.flatMap(FeishuTaskService, (service) =>
        service.createTask({
          summary: "Test Summary",
          description: "Test Description",
          dueTimestamp: "1678886400",
          memberIds: ["user-1"],
          originHref: "https://example.com/task",
          originTitle: "Origin Title",
        })
      );

      // Verify result
      await expect(Effect.runPromise(Effect.provide(program, TestLayer))).rejects.toThrow("Failed to create Feishu task: No task guid in response");
    });

    it("should throw an error if the API call fails", async () => {
      // Create a mock FeishuAuthService
      // Wrap mock rejection so it doesn't fail globally
      const mockCreate = mock().mockImplementation(() => Promise.reject(new Error("API Error")));

      const mockAuthService = {
        client: {
          task: {
            v2: {
              task: {
                create: mockCreate,
              },
            },
          },
        },
        getTenantAccessToken: () => Effect.succeed("mock-token"),
      } as unknown as FeishuAuthService;

      // Provide the mock auth service to the layer
      const AuthLayer = Layer.succeed(FeishuAuthService, mockAuthService);
      const TestLayer = Layer.provide(FeishuTaskServiceLive, AuthLayer);

      // Call createTask
      const program = Effect.flatMap(FeishuTaskService, (service) =>
        service.createTask({
          summary: "Test Summary",
          description: "Test Description",
          dueTimestamp: "1678886400",
          memberIds: ["user-1"],
          originHref: "https://example.com/task",
          originTitle: "Origin Title",
        })
      );

      // Verify result
      await expect(Effect.runPromise(Effect.provide(program, TestLayer))).rejects.toThrow("Failed to create Feishu task: API Error");
    });
  });
});
