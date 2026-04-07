import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";

import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

describe("feishu-task-bindings", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    // Load all convex modules
    const modules = import.meta.glob("../convex/**/*.ts");
    const moduleMap = {
      // Create a thunk that returns the promise of the imported module
      "../convex-modules/feishu-task-bindings.ts": () => import("../convex-modules/feishu-task-bindings.js"),
    };

    // Convert import.meta.glob object format to required format for convexTest
    for (const [path, importFn] of Object.entries(modules)) {
      moduleMap[path] = importFn;
    }

    t = convexTest(schema, moduleMap as any);
  });

  describe("getByTaskGuid", () => {
    it("returns null when no binding exists with the given feishuTaskGuid", async () => {
      const result = await t.query(api.feishuTaskBindings.getByTaskGuid, {
        feishuTaskGuid: "nonexistent-guid",
      });
      expect(result).toBeNull();
    });

    it("returns the binding when it exists", async () => {
      // Insert a dummy project
      const projectId = await t.run(async (ctx) => {
        return await ctx.db.insert("projects", {
          createdBy: "user-1",
          departmentId: "dept-1",
          description: "Test Project",
          name: "Test",
          ownerId: "user-1",
          status: "new",
          sourceEntry: "api",
        });
      });

      // Insert a dummy work item
      const workItemId = await t.run(async (ctx) => {
        return await ctx.db.insert("workItems", {
          description: "Test Work Item",
          priority: "medium",
          projectId,
          status: "todo",
          title: "Test",
        });
      });

      // Insert the target binding
      const bindingId = await t.run(async (ctx) => {
        return await ctx.db.insert("feishuTaskBindings", {
          feishuTaskGuid: "target-guid",
          feishuTaskStatus: "in_progress",
          lastSyncedAt: Date.now(),
          projectId,
          syncDirection: "app_created",
          workItemId,
        });
      });

      const result = await t.query(api.feishuTaskBindings.getByTaskGuid, {
        feishuTaskGuid: "target-guid",
      });

      expect(result).toBeDefined();
      expect(result?._id).toBe(bindingId);
      expect(result?.feishuTaskGuid).toBe("target-guid");
      expect(result?.feishuTaskStatus).toBe("in_progress");
      expect(result?.projectId).toBe(projectId);
      expect(result?.workItemId).toBe(workItemId);
    });
  });
});
