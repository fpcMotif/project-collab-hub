import { convexTest } from "convex-test";
import { describe, expect, it, vi, beforeEach } from "vitest";

import * as approvalGatesModule from "../convex-modules/approval-gates";
import * as auditEvents from "../convex-modules/audit-events";
import * as baseBindingsModule from "../convex-modules/base-bindings";
import * as departmentTracksModule from "../convex-modules/department-tracks";
import * as workItemsModule from "../convex-modules/work-items";
import * as workflowInstancesModule from "../convex-modules/workflow-instances";
import schema from "../convex/schema";

vi.mock("../convex/_generated/server", () => ({
  action: (o: unknown) => o,
  mutation: (o: unknown) => o,
  query: (o: unknown) => o,
}));

vi.mock("../convex/_generated/api", () => {
  // eslint-disable-next-line unicorn/consistent-function-scoping
  const createMockApi = (path = ""): unknown =>
    new Proxy(() => {}, {
      get: (target, prop) => {
        if (typeof prop === "string") {
          return createMockApi(path ? `${path}.${prop}` : prop);
        }
        return target[prop as keyof typeof target];
      },
    });

  return {
    api: createMockApi(),
    internal: createMockApi(),
  };
});

const moduleCache = {
  "../convex-modules/approval-gates.js": () =>
    Promise.resolve(approvalGatesModule),
  "../convex-modules/audit-events.js": () => Promise.resolve(auditEvents),
  "../convex-modules/base-bindings.js": () =>
    Promise.resolve(baseBindingsModule),
  "../convex-modules/department-tracks.js": () =>
    Promise.resolve(departmentTracksModule),
  "../convex-modules/work-items.js": () => Promise.resolve(workItemsModule),
  "../convex-modules/workflow-instances.js": () =>
    Promise.resolve(workflowInstancesModule),
  "../convex/_generated/server.js": () => import("../convex/_generated/server"),
} as unknown as Record<string, () => Promise<unknown>>;

describe("audit-events", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, moduleCache);
  });

  describe("listByProject", () => {
    it("returns empty array when project has no events", async () => {
      const projectId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("projects", {
          createdBy: "user1",
          departmentId: "dept1",
          description: "desc",
          name: "Project 1",
          ownerId: "owner1",
          sourceEntry: "api",
          status: "new",
        });
        await ctx.db.delete(id);
        return id;
      });

      const events = await t.run(
        async (ctx) =>
          await (
            auditEvents.listByProject as unknown as {
              handler: (
                ctx: unknown,
                args: { projectId: string }
              ) => Promise<unknown[]>;
            }
          ).handler(ctx, {
            projectId,
          })
      );

      expect(events).toEqual([]);
    });

    it("returns events correctly filtered by projectId and ordered desc", async () => {
      const { p1Id, p2Id } = await t.run(async (ctx) => {
        const id1 = await ctx.db.insert("projects", {
          createdBy: "user1",
          departmentId: "dept1",
          description: "desc1",
          name: "Project 1",
          ownerId: "owner1",
          sourceEntry: "api",
          status: "new",
        });
        const id2 = await ctx.db.insert("projects", {
          createdBy: "user2",
          departmentId: "dept2",
          description: "desc2",
          name: "Project 2",
          ownerId: "owner2",
          sourceEntry: "api",
          status: "new",
        });
        return { p1Id: id1, p2Id: id2 };
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("auditEvents", {
          action: "created",
          actorId: "actor1",
          changeSummary: "created proj",
          objectId: "obj1",
          objectType: "project",
          projectId: p1Id,
        });
        await ctx.db.insert("auditEvents", {
          action: "updated",
          actorId: "actor1",
          changeSummary: "updated proj",
          objectId: "obj1",
          objectType: "project",
          projectId: p1Id,
        });
        await ctx.db.insert("auditEvents", {
          action: "deleted",
          actorId: "actor2",
          changeSummary: "deleted proj",
          objectId: "obj2",
          objectType: "project",
          projectId: p2Id,
        });
      });

      const p1Events = await t.run(
        async (ctx) =>
          await (
            auditEvents.listByProject as unknown as {
              handler: (
                ctx: unknown,
                args: { projectId: string }
              ) => Promise<{ action: string; projectId?: string }[]>;
            }
          ).handler(ctx, {
            projectId: p1Id,
          })
      );

      expect(p1Events.length).toBe(2);
      for (const e of p1Events) {
        expect(e.projectId).toBe(p1Id);
      }

      expect(p1Events[0].action).toBe("updated");
      expect(p1Events[1].action).toBe("created");
    });
  });
});
