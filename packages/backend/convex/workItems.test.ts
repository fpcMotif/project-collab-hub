import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import schema from "./schema";

// Instead of creating real dummy files in the directory which break check-types,
// we just alias the module import. vitest will intercept the import correctly.
vi.mock("./_generated/server", () => ({
  mutation: (options: any) => options,
  query: (options: any) => options,
  action: (options: any) => options,
  internalMutation: (options: any) => options,
  internalQuery: (options: any) => options,
  internalAction: (options: any) => options,
}));

vi.mock("./_generated/api", () => ({
  api: new Proxy({}, { get: () => new Proxy({}, { get: () => "mock_function" }) }),
  internal: new Proxy({}, { get: () => new Proxy({}, { get: () => "mock_function" }) }),
}));

describe("workItems", () => {
  describe("create", () => {
    it("creates a work item and an audit event successfully", async () => {
      // Mock modules with empty objects just to satisfy import.meta.glob without
      // crashing convexTest on _generated not existing.
      const mockModules = {
        "./workItems.ts": () => import("./workItems.ts" as any),
        "./_generated/server.js": () => import("./_generated/server" as any),
        "./_generated/api.js": () => import("./_generated/api" as any),
      };

      const t = convexTest(schema, mockModules);

      // Create a dummy project first to satisfy foreign key requirement
      const projectId = await t.run(async (ctx) => {
        return await ctx.db.insert("projects", {
          name: "Test Project",
          description: "A project for testing",
          status: "new",
          ownerId: "user123",
          departmentId: "dept123",
          createdBy: "user123",
          sourceEntry: "api",
        });
      });

      const { create } = await import("./workItems");

      const workItemId = await t.run(async (ctx) => {
        return await create.handler(ctx as any, {
          projectId,
          title: "Test Work Item",
          description: "Testing create mutation",
          priority: "high",
          createdBy: "user123",
        });
      });

      expect(workItemId).toBeDefined();

      // Verify the work item was created
      const workItem = await t.run(async (ctx) => {
        return await ctx.db.get(workItemId);
      });

      expect(workItem).toMatchObject({
        _id: workItemId,
        projectId,
        title: "Test Work Item",
        description: "Testing create mutation",
        priority: "high",
        status: "todo",
      });

      // Verify audit event was created
      const auditEvents = await t.run(async (ctx) => {
        return await ctx.db
          .query("auditEvents")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .collect();
      });

      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0]).toMatchObject({
        projectId,
        actorId: "user123",
        action: "work_item.created",
        objectType: "work_item",
        objectId: workItemId,
        changeSummary: 'Work item "Test Work Item" created',
      });
    });
  });
});
