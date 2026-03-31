import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { anyApi } from "convex/server";
import schema from "./schema";
import { modules } from "./test.setup";

describe("projects mutations", () => {
  it("creates a project and an audit event atomically", async () => {
    const t = convexTest(schema, modules);

    const projectId = await t.mutation(anyApi.projects.create, {
      name: "Test Project",
      description: "A project for testing",
      ownerId: "user123",
      departmentId: "dept456",
      createdBy: "user123",
      sourceEntry: "api",
    });

    expect(projectId).toBeDefined();

    const project = await t.run(async (ctx) => {
      return await ctx.db.get(projectId);
    });

    expect(project).toBeDefined();
    expect(project?.name).toBe("Test Project");
    expect(project?.description).toBe("A project for testing");
    expect(project?.ownerId).toBe("user123");
    expect(project?.departmentId).toBe("dept456");
    expect(project?.status).toBe("new");

    const auditEventsResult = await t.run(async (ctx) => {
      return await ctx.db
        .query("auditEvents")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect();
    });

    expect(auditEventsResult).toBeDefined();
    expect(auditEventsResult.length).toBe(1);

    const event = auditEventsResult[0];
    expect(event.action).toBe("project.created");
    expect(event.actorId).toBe("user123");
    expect(event.objectType).toBe("project");
    expect(event.objectId).toBe(projectId);
    expect(event.sourceEntry).toBe("api");
  });
});
