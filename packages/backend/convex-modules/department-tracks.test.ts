import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./_generated/test-modules";

describe("departmentTracks", () => {
  it("should return empty array when project has no department tracks", async () => {
    const t = convexTest(schema, modules);
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

    const tracks = await t.query(api.departmentTracks.listByProject, {
      projectId,
    });
    expect(tracks).toEqual([]);
  });

  it("should return the correct tracks for a specific project", async () => {
    const t = convexTest(schema, modules);
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

    // Create a track for this project
    await t.mutation(api.departmentTracks.create, {
      departmentId: "dep1",
      departmentName: "Test Dept",
      isRequired: true,
      projectId,
    });

    const tracks = await t.query(api.departmentTracks.listByProject, {
      projectId,
    });
    expect(tracks).toHaveLength(1);
    expect(tracks[0].projectId).toBe(projectId);
    expect(tracks[0].departmentId).toBe("dep1");
    expect(tracks[0].status).toBe("not_started");
  });

  it("should not return tracks from other projects", async () => {
    const t = convexTest(schema, modules);

    // Project 1
    const project1Id = await t.run(
      async (ctx) =>
        await ctx.db.insert("projects", {
          createdBy: "user1",
          departmentId: "dep1",
          description: "Project 1",
          name: "Test 1",
          ownerId: "user1",
          sourceEntry: "api",
          status: "new",
        })
    );

    // Project 2
    const project2Id = await t.run(
      async (ctx) =>
        await ctx.db.insert("projects", {
          createdBy: "user1",
          departmentId: "dep1",
          description: "Project 2",
          name: "Test 2",
          ownerId: "user1",
          sourceEntry: "api",
          status: "new",
        })
    );

    // Create a track for Project 1
    await t.mutation(api.departmentTracks.create, {
      departmentId: "dep1",
      departmentName: "Test Dept 1",
      isRequired: true,
      projectId: project1Id,
    });

    // Create a track for Project 2
    await t.mutation(api.departmentTracks.create, {
      departmentId: "dep2",
      departmentName: "Test Dept 2",
      isRequired: false,
      projectId: project2Id,
    });

    const tracks = await t.query(api.departmentTracks.listByProject, {
      projectId: project1Id,
    });
    expect(tracks).toHaveLength(1);
    expect(tracks[0].projectId).toBe(project1Id);
    expect(tracks[0].departmentName).toBe("Test Dept 1");
  });
});
