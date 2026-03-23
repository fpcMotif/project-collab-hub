import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import schema from "../convex/schema";
import { create, listByProject } from "./department-tracks";

// Mock convex/_generated/server to allow convex-test to intercept queries/mutations
vi.mock("../convex/_generated/server", () => ({
  mutation: (args: unknown) => args,
  query: (args: unknown) => args,
}));

describe("departmentTracks.listByProject", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, {
      "./_generated/server.js": () => import("../convex/_generated/server"),
      "./department-tracks.js": () => import("./department-tracks"),
    } as unknown as Record<string, () => Promise<unknown>>);
  });

  it("should return an empty array if no tracks exist for the project", async () => {
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

    const result = await t.run(
      async (ctx) =>
        await listByProject.handler(ctx, { projectId } as unknown as Parameters<
          typeof listByProject.handler
        >[1])
    );

    expect(result).toEqual([]);
  });

  it("should return tracks matching the specified project ID", async () => {
    const project1Id = await t.run(
      async (ctx) =>
        await ctx.db.insert("projects", {
          createdBy: "user1",
          departmentId: "dep1",
          description: "Test Project 1",
          name: "Test 1",
          ownerId: "user1",
          sourceEntry: "api",
          status: "new",
        })
    );

    const project2Id = await t.run(
      async (ctx) =>
        await ctx.db.insert("projects", {
          createdBy: "user1",
          departmentId: "dep1",
          description: "Test Project 2",
          name: "Test 2",
          ownerId: "user1",
          sourceEntry: "api",
          status: "new",
        })
    );

    // Create a track for project 1
    const track1Id = await t.run(
      async (ctx) =>
        await create.handler(ctx, {
          departmentId: "dep1",
          departmentName: "Engineering",
          isRequired: true,
          projectId: project1Id,
        } as unknown as Parameters<typeof create.handler>[1])
    );

    // Create a track for project 2
    await t.run(
      async (ctx) =>
        await create.handler(ctx, {
          departmentId: "dep1",
          departmentName: "Product",
          isRequired: true,
          projectId: project2Id,
        } as unknown as Parameters<typeof create.handler>[1])
    );

    // Create another track for project 1
    const track3Id = await t.run(
      async (ctx) =>
        await create.handler(ctx, {
          departmentId: "dep2",
          departmentName: "Design",
          isRequired: false,
          projectId: project1Id,
        } as unknown as Parameters<typeof create.handler>[1])
    );

    const result = await t.run(
      async (ctx) =>
        await listByProject.handler(ctx, {
          projectId: project1Id,
        } as unknown as Parameters<typeof listByProject.handler>[1])
    );

    expect(result).toHaveLength(2);
    expect((result as { _id: string }[]).map((r) => r._id)).toEqual(
      expect.arrayContaining([track1Id, track3Id])
    );
    expect(
      (result as { projectId: string }[]).every(
        (r) => r.projectId === project1Id
      )
    ).toBe(true);
  });
});
