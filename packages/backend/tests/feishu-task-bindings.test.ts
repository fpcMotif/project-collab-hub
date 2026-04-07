import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach } from "vitest";

import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");

describe("feishu-task-bindings: getByTaskGuid", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("should return null when no matching feishuTaskGuid is found", async () => {
    const result = await t.query(api.feishuTaskBindings.getByTaskGuid, {
      feishuTaskGuid: "non-existent-guid",
    });

    expect(result).toBeNull();
  });

  it("should return the task binding when matching feishuTaskGuid exists", async () => {
    const projectId = await t.run(
      async (ctx) =>
        await ctx.db.insert("projects", {
          createdBy: "user-1",
          departmentId: "dept-1",
          description: "Test description",
          name: "Test Project",
          ownerId: "user-1",
          sourceEntry: "api",
          status: "new",
        })
    );

    const workItemId = await t.run(
      async (ctx) =>
        await ctx.db.insert("workItems", {
          description: "Test description",
          priority: "medium",
          projectId,
          status: "todo",
          title: "Test Work Item",
        })
    );

    const taskGuid = "task-guid-12345";

    const bindingId = await t.run(
      async (ctx) =>
        await ctx.db.insert("feishuTaskBindings", {
          feishuTaskGuid: taskGuid,
          feishuTaskStatus: "0",
          lastSyncedAt: Date.now(),
          projectId,
          syncDirection: "app_created",
          workItemId,
        })
    );

    const result = await t.query(api.feishuTaskBindings.getByTaskGuid, {
      feishuTaskGuid: taskGuid,
    });

    expect(result).not.toBeNull();
    expect(result?._id).toBe(bindingId);
    expect(result?.feishuTaskGuid).toBe(taskGuid);
    expect(result?.workItemId).toBe(workItemId);
  });

  it("should return the first binding when multiple exist for the same guid", async () => {
    const projectId = await t.run(
      async (ctx) =>
        await ctx.db.insert("projects", {
          createdBy: "user-1",
          departmentId: "dept-1",
          description: "Test description",
          name: "Test Project",
          ownerId: "user-1",
          sourceEntry: "api",
          status: "new",
        })
    );

    const workItemId = await t.run(
      async (ctx) =>
        await ctx.db.insert("workItems", {
          description: "Test description",
          priority: "medium",
          projectId,
          status: "todo",
          title: "Test Work Item",
        })
    );

    const taskGuid = "shared-task-guid";

    const bindingId1 = await t.run(
      async (ctx) =>
        await ctx.db.insert("feishuTaskBindings", {
          feishuTaskGuid: taskGuid,
          feishuTaskStatus: "0",
          lastSyncedAt: Date.now(),
          projectId,
          syncDirection: "app_created",
          workItemId,
        })
    );

    _bindingId2 = await t.run(
      async (ctx) =>
        await ctx.db.insert("feishuTaskBindings", {
          feishuTaskGuid: taskGuid,
          feishuTaskStatus: "1",
          lastSyncedAt: Date.now() + 1000,
          projectId,
          syncDirection: "manual_link",
          workItemId,
        })
    );

    const result = await t.query(api.feishuTaskBindings.getByTaskGuid, {
      feishuTaskGuid: taskGuid,
    });

    expect(result).not.toBeNull();
    expect(result?._id).toBe(bindingId1);
  });
});
