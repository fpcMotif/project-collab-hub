import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import { describe, expect, it } from "vitest";

import schema from "../convex/schema";

const modules = {
  "./_generated/server.js": () => import("../convex/_generated/server"),
  "./approvalGates.js": () => import("../convex-modules/approval-gates"),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const insertDummyProject = (
  t: ReturnType<typeof convexTest>,
  name = "Project"
) =>
  t.run((ctx) =>
    ctx.db.insert("projects", {
      createdBy: "user1",
      departmentId: "dept1",
      description: name,
      name,
      ownerId: "user1",
      sourceEntry: "workbench",
      status: "new",
    })
  );

describe("approval-gates", () => {
  describe("listByProject", () => {
    it("returns approval gates for the given project", async () => {
      const t = convexTest(schema, modules);

      const projectId1 = await insertDummyProject(t, "Project 1");
      const projectId2 = await insertDummyProject(t, "Project 2");

      await t.run(async (ctx) => {
        // Insert gates for project 1
        await ctx.db.insert("approvalGates", {
          applicantId: "user1",
          approvalCode: "A001",
          projectId: projectId1,
          status: "pending",
          title: "Gate 1 - Proj 1",
          triggerStage: "new",
        });

        await ctx.db.insert("approvalGates", {
          applicantId: "user1",
          approvalCode: "A002",
          projectId: projectId1,
          status: "approved",
          title: "Gate 2 - Proj 1",
          triggerStage: "assessment",
        });

        // Insert gates for project 2
        await ctx.db.insert("approvalGates", {
          applicantId: "user1",
          approvalCode: "A003",
          projectId: projectId2,
          status: "pending",
          title: "Gate 1 - Proj 2",
          triggerStage: "new",
        });
      });

      const result1 = await t.query(anyApi.approvalGates.listByProject, {
        projectId: projectId1,
      });
      expect(result1.length).toBe(2);
      expect(result1.map((r: { title: string }) => r.title)).toContain(
        "Gate 1 - Proj 1"
      );
      expect(result1.map((r: { title: string }) => r.title)).toContain(
        "Gate 2 - Proj 1"
      );
      expect(result1.map((r: { title: string }) => r.title)).not.toContain(
        "Gate 1 - Proj 2"
      );

      const result2 = await t.query(anyApi.approvalGates.listByProject, {
        projectId: projectId2,
      });
      expect(result2.length).toBe(1);
      expect(result2[0].title).toBe("Gate 1 - Proj 2");
    });

    it("returns empty array for project with no gates", async () => {
      const t = convexTest(schema, modules);
      const emptyProjectId = await insertDummyProject(t, "Empty Project");

      const result = await t.query(anyApi.approvalGates.listByProject, {
        projectId: emptyProjectId,
      });
      expect(result).toEqual([]);
    });
  });

  describe("listPending", () => {
    it("returns only approval gates with status 'pending'", async () => {
      const t = convexTest(schema, modules);
      const projectId = await insertDummyProject(t, "Project 1");

      await t.run(async (ctx) => {
        await ctx.db.insert("approvalGates", {
          applicantId: "user1",
          approvalCode: "A001",
          projectId,
          status: "pending",
          title: "Pending Gate 1",
          triggerStage: "new",
        });
        await ctx.db.insert("approvalGates", {
          applicantId: "user1",
          approvalCode: "A002",
          projectId,
          status: "approved",
          title: "Approved Gate",
          triggerStage: "assessment",
        });
        await ctx.db.insert("approvalGates", {
          applicantId: "user1",
          approvalCode: "A003",
          projectId,
          status: "rejected",
          title: "Rejected Gate",
          triggerStage: "solution",
        });
        await ctx.db.insert("approvalGates", {
          applicantId: "user1",
          approvalCode: "A004",
          projectId,
          status: "pending",
          title: "Pending Gate 2",
          triggerStage: "ready",
        });
      });

      const result = await t.query(anyApi.approvalGates.listPending, {});
      expect(result.length).toBe(2);
      const titles = result.map((r: { title: string }) => r.title);
      expect(titles).toContain("Pending Gate 1");
      expect(titles).toContain("Pending Gate 2");
      expect(titles).not.toContain("Approved Gate");
      expect(titles).not.toContain("Rejected Gate");
    });

    it("returns empty array when no pending gates exist", async () => {
      const t = convexTest(schema, modules);
      const projectId = await insertDummyProject(t, "Project 1");

      await t.run(async (ctx) => {
        await ctx.db.insert("approvalGates", {
          applicantId: "user1",
          approvalCode: "A002",
          projectId,
          status: "approved",
          title: "Approved Gate",
          triggerStage: "assessment",
        });
      });

      const result = await t.query(anyApi.approvalGates.listPending, {});
      expect(result).toEqual([]);
    });
  });
});
