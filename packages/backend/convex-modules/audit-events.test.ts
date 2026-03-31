import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import schema from "../convex/schema";
// Import modules
import * as auditEvents from "./audit-events";

describe("audit-events", () => {
  it("listByProject returns empty array for new project", async () => {
    // 1. Setup convexTest environment
    const t = convexTest(schema, {
      "../convex-modules/audit-events.js": auditEvents,
      "../convex/_generated/server.js": () =>
        import("../convex/_generated/server.js"),
    });

    // 2. We need a valid ID format. According to memory:
    // In Convex tests using `convex-test`, to simulate a 'not found' scenario requiring a structurally valid ID,
    // use `t.run(async (ctx) => { ... })` to insert a temporary document and immediately delete it.
    // This yields a valid ID that refers to an empty record, bypassing Convex's internal ID-format validation errors.
    const projectId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("projects", {
        createdBy: "user1",
        departmentId: "dep1",
        description: "Test Project",
        name: "Test",
        ownerId: "user1",
        sourceEntry: "api",
        status: "new",
      });
      await ctx.db.delete(id);
      return id;
    });

    // 3. Test listByProject
    const result = await t.query(auditEvents.listByProject, { projectId });
    expect(result).toEqual([]);
  });

  it("listByProject returns events sorted by descending order", async () => {
    const t = convexTest(schema, {
      "../convex-modules/audit-events.js": auditEvents,
      "../convex/_generated/server.js": () =>
        import("../convex/_generated/server.js"),
    });

    // Insert a valid project
    const projectId = await t.run(
      async (ctx) =>
        await ctx.db.insert("projects", {
          createdBy: "user1",
          departmentId: "dep1",
          description: "Test Project",
          name: "Test",
          ownerId: "user1",
          sourceEntry: "api",
          status: "new",
        })
    );

    // Insert multiple audit events for the project
    await t.mutation(auditEvents.logSystemEvent, {
      action: "test.action.1",
      changeSummary: "First action",
      objectId: "obj1",
      objectType: "test_type",
      projectId: projectId,
    });

    // Advance time slightly to ensure ordering if order is by creation time
    // convexTest doesn't have fake timers built-in directly but inserts usually get monotonic ids
    // which automatically sort chronologically by default, but let's just insert sequentially.
    await t.mutation(auditEvents.logSystemEvent, {
      action: "test.action.2",
      changeSummary: "Second action",
      objectId: "obj2",
      objectType: "test_type",
      projectId: projectId,
    });

    const result = await t.query(auditEvents.listByProject, { projectId });

    expect(result).toHaveLength(2);
    // order("desc") should mean the most recent one (test.action.2) is first
    expect(result[0].action).toBe("test.action.2");
    expect(result[1].action).toBe("test.action.1");
    expect(result[0].projectId).toBe(projectId);
    expect(result[1].projectId).toBe(projectId);
  });

  it("listByProject does not return events for other projects", async () => {
    const t = convexTest(schema, {
      "../convex-modules/audit-events.js": auditEvents,
      "../convex/_generated/server.js": () =>
        import("../convex/_generated/server.js"),
    });

    const project1Id = await t.run(
      async (ctx) =>
        await ctx.db.insert("projects", {
          createdBy: "user1",
          departmentId: "dep1",
          description: "Test Project 1",
          name: "Test 1",
          ownerId: "user1",
          sourceEntry: "api",
          status: "new",
        })
    );

    const project2Id = await t.run(
      async (ctx) =>
        await ctx.db.insert("projects", {
          createdBy: "user2",
          departmentId: "dep2",
          description: "Test Project 2",
          name: "Test 2",
          ownerId: "user2",
          sourceEntry: "api",
          status: "new",
        })
    );

    await t.mutation(auditEvents.logSystemEvent, {
      action: "action.project.1",
      changeSummary: "Action on project 1",
      objectId: "obj1",
      objectType: "test_type",
      projectId: project1Id,
    });

    await t.mutation(auditEvents.logSystemEvent, {
      action: "action.project.2",
      changeSummary: "Action on project 2",
      objectId: "obj2",
      objectType: "test_type",
      projectId: project2Id,
    });

    const result1 = await t.query(auditEvents.listByProject, {
      projectId: project1Id,
    });
    expect(result1).toHaveLength(1);
    expect(result1[0].action).toBe("action.project.1");

    const result2 = await t.query(auditEvents.listByProject, {
      projectId: project2Id,
    });
    expect(result2).toHaveLength(1);
    expect(result2[0].action).toBe("action.project.2");
  });
});
