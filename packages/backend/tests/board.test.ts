import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");

describe("board performance", () => {
  it("benchmarks listBoardProjects", async () => {
    const t = convexTest(schema, modules);

    // Create a user identity
    const asUser = t.withIdentity({ subject: "user_123" });

    // Seed data
    console.log("Seeding data...");
    const numProjects = 50;

    for (let i = 0; i < numProjects; i += 1) {
      await t.run(async (ctx) => {
        const projectId = await ctx.db.insert("projects", {
          createdBy: "user_123",
          departmentId: "dept_1",
          description: `Description ${i}`,
          name: `Project ${i}`,
          ownerId: "user_123",
          sourceEntry: "api",
          status: "new",
        });

        // Add 2 department tracks per project
        await ctx.db.insert("departmentTracks", {
          departmentId: "dept_1",
          departmentName: "Dev",
          isRequired: true,
          projectId,
          status: "not_started",
        });
        await ctx.db.insert("departmentTracks", {
          departmentId: "dept_2",
          departmentName: "Design",
          isRequired: false,
          projectId,
          status: "not_required",
        });

        // Add 5 work items per project
        for (let j = 0; j < 5; j += 1) {
          await ctx.db.insert("workItems", {
            description: "A task",
            dueDate: Date.now() - 1000,
            priority: "medium",
            projectId,
            status: "todo",
            title: `Task ${j}`,
          });
        }

        // Add 1 approval gate
        await ctx.db.insert("approvalGates", {
          applicantId: "user_123",
          approvalCode: "APP_123",
          projectId,
          status: "pending",
          title: "Approval",
          triggerStage: "assessment",
        });
      });
    }

    console.log("Running baseline benchmark...");
    const start = performance.now();
    const result = await asUser.query(api.board.listBoardProjects);
    const end = performance.now();

    console.log(
      `listBoardProjects fetched ${result.length} projects in ${end - start} ms`
    );
    expect(result.length).toBe(numProjects);
  });
});
