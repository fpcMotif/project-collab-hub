import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.*s");

describe("projects queries", () => {
  test("projects.list without status returns all projects", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("projects", {
        name: "Project A",
        description: "Desc A",
        ownerId: "user1",
        departmentId: "dep1",
        createdBy: "user1",
        sourceEntry: "api",
        status: "new",
      });
      await ctx.db.insert("projects", {
        name: "Project B",
        description: "Desc B",
        ownerId: "user2",
        departmentId: "dep2",
        createdBy: "user2",
        sourceEntry: "api",
        status: "done",
      });
    });

    // Call the query through the convexTest instance using path strings
    const result = await t.query("projects:list", {});

    expect(result).toHaveLength(2);
    expect(result.map(p => p.name).sort()).toEqual(["Project A", "Project B"]);
  });

  test("projects.list with status returns filtered projects", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("projects", {
        name: "Project A",
        description: "Desc A",
        ownerId: "user1",
        departmentId: "dep1",
        createdBy: "user1",
        sourceEntry: "api",
        status: "new",
      });
      await ctx.db.insert("projects", {
        name: "Project B",
        description: "Desc B",
        ownerId: "user2",
        departmentId: "dep2",
        createdBy: "user2",
        sourceEntry: "api",
        status: "done",
      });
      await ctx.db.insert("projects", {
        name: "Project C",
        description: "Desc C",
        ownerId: "user3",
        departmentId: "dep3",
        createdBy: "user3",
        sourceEntry: "api",
        status: "new",
      });
    });

    const result = await t.query("projects:list", { status: "new" });

    expect(result).toHaveLength(2);
    expect(result.every(p => p.status === "new")).toBe(true);
    expect(result.map(p => p.name).sort()).toEqual(["Project A", "Project C"]);
  });

  test("projects.list returns empty array when no projects match status", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("projects", {
        name: "Project A",
        description: "Desc A",
        ownerId: "user1",
        departmentId: "dep1",
        createdBy: "user1",
        sourceEntry: "api",
        status: "new",
      });
    });

    const result = await t.query("projects:list", { status: "cancelled" });

    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });
});
