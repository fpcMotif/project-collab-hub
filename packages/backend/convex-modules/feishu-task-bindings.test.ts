import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import { test, expect, describe, beforeEach } from "vitest";

import schema from "../convex/schema";

const modules = {
  "../convex/_generated/server.js": () =>
    import("../convex/_generated/server.js"),
  "../convex/feishuTaskBindings.ts": () =>
    import("../convex/feishuTaskBindings"),
};

describe("feishuTaskBindings - applyTaskEvent", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  test("skips if auditEvent with same idempotencyKey already exists", async () => {
    const projectId = await t.run(
      async (ctx) =>
        await ctx.db.insert("projects", {
          createdBy: "user1",
          departmentId: "dept1",
          description: "description",
          name: "Test Project",
          ownerId: "user1",
          sourceEntry: "api",
          status: "new",
        })
    );

    await t.run(async (ctx) => {
      await ctx.db.insert("auditEvents", {
        action: "work_item.status_changed",
        actorId: "system",
        changeSummary: "already processed",
        idempotencyKey: "test-idempotency-key",
        objectId: "some-object",
        objectType: "work_item",
        projectId,
      });
    });

    await t.mutation(anyApi.feishuTaskBindings.applyTaskEvent, {
      feishuTaskGuid: "task-123",
      feishuTaskStatus: "completed",
      idempotencyKey: "test-idempotency-key",
      workItemStatus: "done",
    });

    const bindings = await t.run(
      async (ctx) => await ctx.db.query("feishuTaskBindings").collect()
    );
    expect(bindings).toHaveLength(0);
  });

  test("skips if no feishuTaskBinding is found for the given feishuTaskGuid", async () => {
    await t.mutation(anyApi.feishuTaskBindings.applyTaskEvent, {
      feishuTaskGuid: "non-existent-task",
      feishuTaskStatus: "completed",
      idempotencyKey: "idempotency-key-2",
      workItemStatus: "done",
    });

    const auditEvents = await t.run(
      async (ctx) => await ctx.db.query("auditEvents").collect()
    );
    expect(auditEvents).toHaveLength(0);
  });

  test("skips if a feishuTaskBinding is found but workItemId is not found", async () => {
    const ids = await t.run(async (ctx) => {
      const pId = await ctx.db.insert("projects", {
        createdBy: "user1",
        departmentId: "dept1",
        description: "description",
        name: "Test Project",
        ownerId: "user1",
        sourceEntry: "api",
        status: "new",
      });

      const wId = await ctx.db.insert("workItems", {
        description: "description",
        priority: "medium",
        projectId: pId,
        status: "todo",
        title: "Test Work Item",
      });
      await ctx.db.delete(wId);
      return { pId, wId };
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("feishuTaskBindings", {
        feishuTaskGuid: "task-with-invalid-work-item",
        feishuTaskStatus: "active",
        lastSyncedAt: Date.now(),
        projectId: ids.pId,
        syncDirection: "app_created",
        workItemId: ids.wId,
      });
    });

    await t.mutation(anyApi.feishuTaskBindings.applyTaskEvent, {
      feishuTaskGuid: "task-with-invalid-work-item",
      feishuTaskStatus: "completed",
      idempotencyKey: "idempotency-key-3",
      workItemStatus: "done",
    });

    const auditEvents = await t.run(
      async (ctx) => await ctx.db.query("auditEvents").collect()
    );
    expect(auditEvents).toHaveLength(0);

    const binding = await t.run(
      async (ctx) => await ctx.db.query("feishuTaskBindings").first()
    );
    // Only the binding got updated
    expect(binding?.feishuTaskStatus).toBe("completed");
  });

  test("successfully updates feishuTaskStatus, workItemStatus to in_progress, and adds auditEvent", async () => {
    const ids = await t.run(async (ctx) => {
      const pId = await ctx.db.insert("projects", {
        createdBy: "user1",
        departmentId: "dept1",
        description: "description",
        name: "Test Project",
        ownerId: "user1",
        sourceEntry: "api",
        status: "new",
      });

      const wId = await ctx.db.insert("workItems", {
        description: "description",
        priority: "medium",
        projectId: pId,
        status: "todo",
        title: "Real Work Item",
      });
      return { pId, wId };
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("feishuTaskBindings", {
        feishuTaskGuid: "task-success-1",
        feishuTaskStatus: "active",
        lastSyncedAt: Date.now() - 10_000,
        projectId: ids.pId,
        syncDirection: "app_created",
        workItemId: ids.wId,
      });
    });

    await t.mutation(anyApi.feishuTaskBindings.applyTaskEvent, {
      feishuTaskGuid: "task-success-1",
      feishuTaskStatus: "in_progress",
      idempotencyKey: "idempotency-key-4",
      workItemStatus: "in_progress",
    });

    const binding = await t.run(
      async (ctx) => await ctx.db.query("feishuTaskBindings").first()
    );
    expect(binding?.feishuTaskStatus).toBe("in_progress");

    const workItem = await t.run(async (ctx) => await ctx.db.get(ids.wId));
    expect(workItem?.status).toBe("in_progress");
    expect(workItem?.completedAt).toBeUndefined();

    const auditEvent = await t.run(
      async (ctx) => await ctx.db.query("auditEvents").first()
    );
    expect(auditEvent?.action).toBe("work_item.status_changed");
    expect(auditEvent?.changeSummary).toContain("in_progress");
    expect(auditEvent?.idempotencyKey).toBe("idempotency-key-4");
  });

  test("successfully updates workItemStatus to done and sets completedAt", async () => {
    const ids = await t.run(async (ctx) => {
      const pId = await ctx.db.insert("projects", {
        createdBy: "user1",
        departmentId: "dept1",
        description: "description",
        name: "Test Project",
        ownerId: "user1",
        sourceEntry: "api",
        status: "new",
      });

      const wId = await ctx.db.insert("workItems", {
        description: "description",
        priority: "medium",
        projectId: pId,
        status: "in_progress",
        title: "Done Work Item",
      });
      return { pId, wId };
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("feishuTaskBindings", {
        feishuTaskGuid: "task-success-2",
        feishuTaskStatus: "active",
        lastSyncedAt: Date.now() - 10_000,
        projectId: ids.pId,
        syncDirection: "app_created",
        workItemId: ids.wId,
      });
    });

    await t.mutation(anyApi.feishuTaskBindings.applyTaskEvent, {
      feishuTaskGuid: "task-success-2",
      feishuTaskStatus: "completed",
      idempotencyKey: "idempotency-key-5",
      workItemStatus: "done",
    });

    const workItem = await t.run(async (ctx) => await ctx.db.get(ids.wId));
    expect(workItem?.status).toBe("done");
    expect(workItem?.completedAt).toBeDefined();

    const auditEvent = await t.run(
      async (ctx) => await ctx.db.query("auditEvents").first()
    );
    expect(auditEvent?.action).toBe("work_item.status_changed");
    expect(auditEvent?.changeSummary).toContain("done");
  });
});
