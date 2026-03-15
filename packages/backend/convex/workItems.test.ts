import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema.js";

// Since we cannot rely on the fake convex-test generated imports mapping correctly with Vite without running `npx convex dev`,
// we will just use `t.run` and invoke the handler directly with test ctx.
import * as workItems from "./workItems";
const modules = import.meta.glob("./**/*.*");

describe("workItems", () => {
  it("should create a work item and log an audit event", async () => {
    const t = convexTest(schema, modules);

    // Create a mock project
    const projectId = await t.run(async (ctx) => {
      return await ctx.db.insert("projects", {
        name: "Test Project",
        description: "A project for testing",
        status: "new",
        ownerId: "user1",
        departmentId: "dept1",
        createdBy: "user1",
        sourceEntry: "api",
      });
    });

    const workItemId = await t.run(async (ctx) => {
      return await (workItems.create as any).handler(ctx, {
        projectId,
        title: "New Task",
        description: "This is a test task",
        priority: "high",
        createdBy: "user1",
      });
    });

    // Verify the work item was created
    const workItem = await t.run(async (ctx) => {
      return await ctx.db.get(workItemId);
    });

    expect(workItem).toBeDefined();
    expect(workItem?.title).toBe("New Task");
    expect(workItem?.description).toBe("This is a test task");
    expect(workItem?.priority).toBe("high");
    expect(workItem?.status).toBe("todo");

    // Verify the audit event was created
    const auditEvents = await t.run(async (ctx) => {
      return await ctx.db.query("auditEvents").collect();
    });

    expect(auditEvents.length).toBe(1);
    expect(auditEvents[0].projectId).toBe(projectId);
    expect(auditEvents[0].actorId).toBe("user1");
    expect(auditEvents[0].action).toBe("work_item.created");
    expect(auditEvents[0].objectType).toBe("work_item");
    expect(auditEvents[0].objectId).toBe(workItemId);
    expect(auditEvents[0].changeSummary).toBe('Work item "New Task" created');
  });
});
