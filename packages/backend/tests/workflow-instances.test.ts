import { describe, expect, it, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { anyApi } from "convex/server";

// Import module for testing
import * as workflowInstances from "../convex-modules/workflow-instances";

// Silence convex-test warnings by passing string name for module
const modules = {
  "../convex-modules/workflow-instances.js": () => import("../convex-modules/workflow-instances"),
  "../convex/_generated/server.js": () => import("../convex/_generated/server")
} as any;

describe("workflow-instances", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  const createProject = async (name: string, ownerId: string = "o1") => {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("projects", {
        createdBy: "u1",
        name,
        description: "Desc",
        departmentId: "d1",
        ownerId,
        sourceEntry: "workbench",
        status: "new",
      });
    });
  };

  const createWorkflowInstance = async (
    projectId: any,
    feishuInstanceCode: string,
    status: any = "pending"
  ) => {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("workflowInstances", {
        feishuInstanceCode,
        feishuWorkflowCode: `fw_${feishuInstanceCode}`,
        projectId,
        status,
        triggeredBy: "u1",
      });
    });
  };

  it("returns empty when no instances exist for project", async () => {
    const projectId = await createProject("Project A");

    // Using `anyApi` and passing the function directly avoids standard import check warnings in some environments,
    // though the convex-test framework prefers passing the path. The current way triggers a harmless warning that we can ignore or suppress via mock, but since the mock breaks without the full generated code, we leave it as is.
    const results = await t.query(workflowInstances.listByProject, { projectId });
    expect(results).toEqual([]);
  });

  it("returns workflow instances matching project id", async () => {
    const projectId = await createProject("Project A");

    const instanceId1 = await createWorkflowInstance(projectId, "fi_123", "pending");
    const instanceId2 = await createWorkflowInstance(projectId, "fi_456", "approved");

    const results = await t.query(workflowInstances.listByProject, { projectId });
    expect(results).toHaveLength(2);
    expect(results.map((r: any) => r._id)).toEqual(
      expect.arrayContaining([instanceId1, instanceId2])
    );
  });

  it("isolates workflow instances from different projects", async () => {
    const project1Id = await createProject("Project 1");
    const project2Id = await createProject("Project 2");

    const instance1 = await createWorkflowInstance(project1Id, "fi_p1", "running");
    await createWorkflowInstance(project2Id, "fi_p2", "pending");

    const p1Results = await t.query(workflowInstances.listByProject, { projectId: project1Id });
    expect(p1Results).toHaveLength(1);
    expect(p1Results[0]._id).toBe(instance1);

    const p2Results = await t.query(workflowInstances.listByProject, { projectId: project2Id });
    expect(p2Results).toHaveLength(1);
    expect(p2Results[0].projectId).toBe(project2Id);
  });
});
