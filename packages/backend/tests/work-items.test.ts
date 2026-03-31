import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { listByProject } from "../convex-modules/work-items";
import schema from "../convex/schema";

// @ts-expect-error - vitest/vite provides import.meta.glob
const globModules = import.meta.glob("../**/*.*s");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modules = {
  ...globModules,
  "../convex-modules/work-items.js":
    globModules["../convex-modules/work-items.ts"],
  "../convex/_generated/server.js": () =>
    import("../convex/_generated/server.js"),
} as unknown;

describe("work-items", () => {
  it("listByProject returns all work items for a specific project", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = convexTest(schema, modules as Record<string, any>);

    const projectId = await t.run(
      async (ctx) =>
        await ctx.db.insert("projects", {
          createdBy: "user1",
          departmentId: "dept1",
          description: "Test Project",
          name: "Test Project",
          ownerId: "user1",
          sourceEntry: "api",
          status: "new",
        })
    );

    await t.run(async (ctx) => {
      await ctx.db.insert("workItems", {
        description: "Task 1",
        priority: "medium",
        projectId: projectId,
        status: "todo",
        title: "Task 1",
      });
      await ctx.db.insert("workItems", {
        description: "Task 2",
        priority: "high",
        projectId: projectId,
        status: "in_progress",
        title: "Task 2",
      });
    });

    const items = await t.run((ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (listByProject as unknown as { _handler: any })._handler;
      return handler(ctx, { projectId }) as Promise<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any[]
      >;
    });

    expect(items.length).toBe(2);
    expect(items[0].title).toBe("Task 1");
    expect(items[1].title).toBe("Task 2");
  });

  it("listByProject returns an empty array if project has no work items", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = convexTest(schema, modules as Record<string, any>);

    const projectId = await t.run(
      async (ctx) =>
        await ctx.db.insert("projects", {
          createdBy: "user1",
          departmentId: "dept1",
          description: "Empty Project",
          name: "Empty Project",
          ownerId: "user1",
          sourceEntry: "api",
          status: "new",
        })
    );

    const items = await t.run((ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (listByProject as unknown as { _handler: any })._handler;
      return handler(ctx, { projectId }) as Promise<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any[]
      >;
    });

    expect(items.length).toBe(0);
  });

  it("listByProject ignores work items from other projects", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = convexTest(schema, modules as Record<string, any>);

    // Project 1
    const p1Id = await t.run(
      async (ctx) =>
        await ctx.db.insert("projects", {
          createdBy: "user1",
          departmentId: "dept1",
          description: "Project 1",
          name: "Project 1",
          ownerId: "user1",
          sourceEntry: "api",
          status: "new",
        })
    );

    // Project 2
    const p2Id = await t.run(
      async (ctx) =>
        await ctx.db.insert("projects", {
          createdBy: "user1",
          departmentId: "dept1",
          description: "Project 2",
          name: "Project 2",
          ownerId: "user1",
          sourceEntry: "api",
          status: "new",
        })
    );

    await t.run(async (ctx) => {
      // Items for Project 1
      await ctx.db.insert("workItems", {
        description: "P1 Task",
        priority: "medium",
        projectId: p1Id,
        status: "todo",
        title: "P1 Task",
      });
      // Items for Project 2
      await ctx.db.insert("workItems", {
        description: "P2 Task",
        priority: "high",
        projectId: p2Id,
        status: "todo",
        title: "P2 Task",
      });
    });

    const p1Items = await t.run((ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (listByProject as unknown as { _handler: any })._handler;
      return handler(ctx, {
        projectId: p1Id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as Promise<any[]>;
    });
    expect(p1Items.length).toBe(1);
    expect(p1Items[0].title).toBe("P1 Task");

    const p2Items = await t.run((ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (listByProject as unknown as { _handler: any })._handler;
      return handler(ctx, {
        projectId: p2Id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as Promise<any[]>;
    });
    expect(p2Items.length).toBe(1);
    expect(p2Items[0].title).toBe("P2 Task");
  });
});
