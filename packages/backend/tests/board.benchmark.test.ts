import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import { describe, expect, it } from "vitest";

import * as board from "../convex/board";
import schema from "../convex/schema";
const mockApi = anyApi as unknown as Record<string, unknown>;
mockApi.board = board;

describe("Board performance benchmark", () => {
  it("measure getProjectDetail with many comments", async () => {
    // 1. Initialize test environment
    const t = convexTest(schema, {
      "../convex/_generated/server.js": () =>
        import("../convex/_generated/server"),
      "../convex/board.js": () => import("../convex/board"),
    } as unknown as Record<string, () => Promise<unknown>>);

    // Provide a mocked user identity - Need to use standard OpenID connect properties
    t.withIdentity({
      audience: "convex",
      issuer: "https://example.com/",
      subject: "test_user_1",
    });

    // 2. Setup mock data: 1 project, 100 comments, 200 mentions
    const projectId = await t.run(async (ctx) => {
      const createdProjectId = await ctx.db.insert("projects", {
        createdBy: "test_user_1",
        departmentId: "dep_1",
        description: "Benchmark Project",
        name: "Performance Test Project",
        ownerId: "test_user_1",
        sourceEntry: "api",
        status: "executing",
      });

      // Insert comments and mentions
      for (let i = 0; i < 50; i += 1) {
        const commentId = await ctx.db.insert("comments", {
          authorId: "test_user_1",
          body: `Comment ${i}`,
          isDeleted: false,
          projectId: createdProjectId,
          targetScope: "project",
        });

        // Insert 2 mentions per comment
        for (let j = 0; j < 2; j += 1) {
          await ctx.db.insert("mentions", {
            commentId: commentId,
            mentionedByUserId: "test_user_1",
            mentionedUserId: `user_${j}`,
            notificationSent: false,
            projectId: createdProjectId,
          });
        }
      }

      return createdProjectId;
    });

    // 3. Measure performance directly
    let totalTime = 0;
    const iterations = 5;
    let lastResult;

    // warm up
    await t
      .withIdentity({
        audience: "convex",
        issuer: "https://example.com/",
        subject: "test_user_1",
      })
      .query(mockApi.board.getProjectDetail, { projectId });

    for (let i = 0; i < iterations; i += 1) {
      const startTime = performance.now();

      lastResult = await t
        .withIdentity({
          audience: "convex",
          issuer: "https://example.com/",
          subject: "test_user_1",
        })
        .query(mockApi.board.getProjectDetail, { projectId });

      const endTime = performance.now();
      totalTime += endTime - startTime;
    }

    const averageExecutionTime = totalTime / iterations;
    console.log(
      `\n\n=======================================================\n`
    );
    console.log(
      `⏱️ Baseline getProjectDetail average execution time: ${averageExecutionTime.toFixed(2)} ms over ${iterations} iterations`
    );
    console.log(
      `\n=======================================================\n\n`
    );

    expect(lastResult).not.toBeNull();
    expect(lastResult?.comments.length).toBe(50);
  });
});
