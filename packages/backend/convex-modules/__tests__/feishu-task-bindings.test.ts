import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";

vi.mock("../../convex/_generated/server", () => ({
  mutation: (o: unknown) => o,
  query: (o: unknown) => o,
}));

const modules = {
  "_generated/server.js": () => import("../../convex/_generated/server.js"),
  "feishu-task-bindings.js": () => import("../feishu-task-bindings.js"),
};

describe("applyTaskEvent", () => {
  it("aborts if auditEvent with idempotencyKey already exists", async () => {
    const t = convexTest(schema, modules);

    // Provide idempotency key
    const idempotencyKey = "idempotency-key-1";

    // Insert existing audit event
    await t.run(async (ctx) => {
      await ctx.db.insert("auditEvents", {
        action: "work_item.status_changed",
        actorId: "system",
        changeSummary: "already processed",
        idempotencyKey,
        objectId: "some-id",
        objectType: "work_item",
      });
    });

    // Run mutation
    await t.run(async (ctx) => {
      const bindingModule = await modules["feishu-task-bindings.js"]();
      await bindingModule.applyTaskEvent.handler(ctx, {
        feishuTaskGuid: "task-guid-1",
        feishuTaskStatus: "completed",
        idempotencyKey,
        workItemStatus: "done",
      });
    });

    // Verify no feishu task binding patch happened or new audit event inserted
    const events = await t.run(
      async (ctx) => await ctx.db.query("auditEvents").collect()
    );

    expect(events.length).toBe(1);
    expect(events[0].idempotencyKey).toBe(idempotencyKey);
  });

  it("aborts if feishuTaskBindings by feishuTaskGuid is not found", async () => {
    const t = convexTest(schema, modules);

    // Provide idempotency key
    const idempotencyKey = "idempotency-key-2";

    // Run mutation
    await t.run(async (ctx) => {
      const bindingModule = await modules["feishu-task-bindings.js"]();
      await bindingModule.applyTaskEvent.handler(ctx, {
        feishuTaskGuid: "non-existent-guid",
        feishuTaskStatus: "completed",
        idempotencyKey,
        workItemStatus: "done",
      });
    });

    // Verify no new audit event inserted
    const events = await t.run(
      async (ctx) => await ctx.db.query("auditEvents").collect()
    );

    expect(events.length).toBe(0);
  });

  it("aborts if workItem bound is not found", async () => {
    const t = convexTest(schema, modules);

    // Provide idempotency key
    const idempotencyKey = "idempotency-key-3";
    const feishuTaskGuid = "task-guid-3";

    await t.run(async (ctx) => {
      // Create a dummy project id since it is required
      const projectId = await ctx.db.insert("projects", {
        createdBy: "user",
        departmentId: "dept",
        description: "desc",
        name: "name",
        ownerId: "owner",
        sourceEntry: "api",
        status: "new",
      });

      // Create a dummy workItemId that doesn't actually exist
      const workItemId = await ctx.db.insert("workItems", {
        description: "desc",
        priority: "low",
        projectId,
        status: "todo",
        title: "title",
      });
      await ctx.db.delete(workItemId);

      // Insert task binding pointing to the non-existent work item
      await ctx.db.insert("feishuTaskBindings", {
        feishuTaskGuid,
        feishuTaskStatus: "in_progress",
        lastSyncedAt: Date.now(),
        projectId,
        syncDirection: "manual_link",
        workItemId,
      });
    });

    // Run mutation
    await t.run(async (ctx) => {
      const bindingModule = await modules["feishu-task-bindings.js"]();
      await bindingModule.applyTaskEvent.handler(ctx, {
        feishuTaskGuid,
        feishuTaskStatus: "completed",
        idempotencyKey,
        workItemStatus: "done",
      });
    });

    // Verify no new audit event inserted
    const events = await t.run(
      async (ctx) => await ctx.db.query("auditEvents").collect()
    );

    expect(events.length).toBe(0);
  });

  it("successfully updates feishuTaskBindings and workItem (without done status) and inserts auditEvents record", async () => {
    const t = convexTest(schema, modules);

    const idempotencyKey = "idempotency-key-4";
    const feishuTaskGuid = "task-guid-4";

    let workItemId: string;
    let bindingId: string;

    await t.run(async (ctx) => {
      const projectId = await ctx.db.insert("projects", {
        createdBy: "user",
        departmentId: "dept",
        description: "desc",
        name: "name",
        ownerId: "owner",
        sourceEntry: "api",
        status: "new",
      });

      workItemId = await ctx.db.insert("workItems", {
        description: "desc",
        priority: "low",
        projectId,
        status: "todo",
        title: "My Work Item",
      });

      bindingId = await ctx.db.insert("feishuTaskBindings", {
        feishuTaskGuid,
        feishuTaskStatus: "pending",
        lastSyncedAt: Date.now(),
        projectId,
        syncDirection: "manual_link",
        workItemId: workItemId as unknown as Id<"workItems">,
      });
    });

    // Run mutation
    await t.run(async (ctx) => {
      const bindingModule = await modules["feishu-task-bindings.js"]();
      await bindingModule.applyTaskEvent.handler(ctx, {
        feishuTaskGuid,
        feishuTaskStatus: "in_progress",
        idempotencyKey,
        workItemStatus: "in_progress",
      });
    });

    await t.run(async (ctx) => {
      const binding = await ctx.db.get(
        bindingId as unknown as Id<"feishuTaskBindings">
      );
      expect(binding?.feishuTaskStatus).toBe("in_progress");

      const workItem = await ctx.db.get(
        workItemId as unknown as Id<"workItems">
      );
      expect(workItem?.status).toBe("in_progress");
      expect(workItem?.completedAt).toBeUndefined();

      const events = await ctx.db.query("auditEvents").collect();
      expect(events.length).toBe(1);
      expect(events[0].idempotencyKey).toBe(idempotencyKey);
      expect(events[0].action).toBe("work_item.status_changed");
      expect(events[0].changeSummary).toContain(
        '"My Work Item" status synced from Feishu task to in_progress'
      );
      expect(events[0].objectId).toBe(workItemId);
    });
  });

  it("successfully updates feishuTaskBindings and workItem to done (setting completedAt) and inserts auditEvents record", async () => {
    const t = convexTest(schema, modules);

    const idempotencyKey = "idempotency-key-5";
    const feishuTaskGuid = "task-guid-5";

    let workItemId: string;
    let bindingId: string;

    await t.run(async (ctx) => {
      const projectId = await ctx.db.insert("projects", {
        createdBy: "user",
        departmentId: "dept",
        description: "desc",
        name: "name",
        ownerId: "owner",
        sourceEntry: "api",
        status: "new",
      });

      workItemId = await ctx.db.insert("workItems", {
        description: "desc",
        priority: "low",
        projectId,
        status: "in_progress",
        title: "My Work Item 2",
      });

      bindingId = await ctx.db.insert("feishuTaskBindings", {
        feishuTaskGuid,
        feishuTaskStatus: "in_progress",
        lastSyncedAt: Date.now(),
        projectId,
        syncDirection: "manual_link",
        workItemId: workItemId as unknown as Id<"workItems">,
      });
    });

    // Run mutation
    await t.run(async (ctx) => {
      const bindingModule = await modules["feishu-task-bindings.js"]();
      await bindingModule.applyTaskEvent.handler(ctx, {
        feishuTaskGuid,
        feishuTaskStatus: "completed",
        idempotencyKey,
        workItemStatus: "done",
      });
    });

    await t.run(async (ctx) => {
      const binding = await ctx.db.get(
        bindingId as unknown as Id<"feishuTaskBindings">
      );
      expect(binding?.feishuTaskStatus).toBe("completed");

      const workItem = await ctx.db.get(
        workItemId as unknown as Id<"workItems">
      );
      expect(workItem?.status).toBe("done");
      expect(workItem?.completedAt).toBeDefined();

      const events = await ctx.db.query("auditEvents").collect();
      expect(events.length).toBe(1);
      expect(events[0].idempotencyKey).toBe(idempotencyKey);
      expect(events[0].action).toBe("work_item.status_changed");
      expect(events[0].changeSummary).toContain(
        '"My Work Item 2" status synced from Feishu task to done'
      );
      expect(events[0].objectId).toBe(workItemId);
    });
  });
});
