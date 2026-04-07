import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

import schema from "../convex/schema";
import { getByTaskGuid } from "./feishu-task-bindings";

vi.mock("../convex/_generated/server", () => ({
  mutation: (args: unknown) => args,
  query: (args: unknown) => args,
}));

const modules = import.meta.glob("../convex/**/*.ts");

// Define an interface for the query so we don't have to use 'any'
interface MockedQuery {
  handler: (ctx: unknown, args: unknown) => Promise<unknown>;
}

describe("getByTaskGuid", () => {
  it("should return the task binding if it exists", async () => {
    const t = convexTest(schema, modules);

    // Seed database
    const feishuTaskGuid = "test-task-guid-123";

    await t.run(async (ctx) => {
      // Create a dummy project
      const projectId = await ctx.db.insert("projects", {
        createdBy: "user1",
        departmentId: "dep1",
        description: "Test Project",
        name: "Test",
        ownerId: "user1",
        sourceEntry: "api",
        status: "new",
      });

      // Create a dummy work item
      const workItemId = await ctx.db.insert("workItems", {
        description: "Test Work Item",
        priority: "medium",
        projectId,
        status: "todo",
        title: "Task 1",
      });

      // Insert the feishu task binding
      await ctx.db.insert("feishuTaskBindings", {
        feishuTaskGuid,
        feishuTaskStatus: "pending",
        lastSyncedAt: Date.now(),
        projectId,
        syncDirection: "app_created",
        workItemId,
      });
    });

    const result = await t.run(
      async (ctx) =>
        (await (getByTaskGuid as unknown as MockedQuery).handler(ctx, {
          feishuTaskGuid,
        })) as Record<string, unknown> | null
    );

    expect(result).not.toBeNull();
    expect(result?.feishuTaskGuid).toBe(feishuTaskGuid);
    expect(result?.feishuTaskStatus).toBe("pending");
  });

  it("should return null if the task binding does not exist", async () => {
    const t = convexTest(schema, modules);

    const result = await t.run(
      async (ctx) =>
        await (getByTaskGuid as unknown as MockedQuery).handler(ctx, {
          feishuTaskGuid: "non-existent-guid",
        })
    );

    expect(result).toBeNull();
  });
});
