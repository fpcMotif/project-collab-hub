import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach } from "vitest";
import schema from "./schema";

// Import modules manually
import * as comments from "./comments";

const modules = import.meta.glob("./**/*.*");

describe("comments", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("should create a comment with mentions and handle deduplication", async () => {
    const projectId = await t.run(async (ctx) => {
      return await ctx.db.insert("projects", {
        name: "Test Project",
        description: "Test",
        status: "new",
        ownerId: "user1",
        departmentId: "dept1",
        createdBy: "user1",
        sourceEntry: "workbench",
      });
    });

    const commentId = await t.run(async (ctx) => {
      // Call the original actual handler of the `create` mutation directly
      // we extract it via `.handler` because our mock `mutation` wrapper returned the object
      return await (comments.create as any).handler(ctx, {
        projectId,
        authorId: "user1",
        body: "Hello @user2 @user3 and @user2 again",
        targetScope: "project",
        mentionedUserIds: ["user2", "user3", "user2"], // Contains duplicate
      });
    });

    expect(commentId).toBeDefined();

    const mentions = await t.run(async (ctx) => {
      return await ctx.db
        .query("mentions")
        .withIndex("by_comment", (q) => q.eq("commentId", commentId))
        .collect();
    });

    // Verify deduplication
    expect(mentions.length).toBe(2);
    expect(mentions.map((m) => m.mentionedUserId).sort()).toEqual(["user2", "user3"]);
    expect(mentions[0].projectId).toBe(projectId);
    expect(mentions[0].mentionedByUserId).toBe("user1");
    expect(mentions[0].notificationSent).toBe(false);
    expect(mentions[1].notificationSent).toBe(false);

    // Also verify audit event was created
    const auditEvents = await t.run(async (ctx) => {
        return await ctx.db.query("auditEvents").collect();
    });

    expect(auditEvents.length).toBe(1);
    expect(auditEvents[0].action).toBe("comment.created");
    expect(auditEvents[0].objectId).toBe(commentId);
  });

  it("should create a comment without mentions correctly", async () => {
      const projectId = await t.run(async (ctx) => {
        return await ctx.db.insert("projects", {
          name: "Test Project",
          description: "Test",
          status: "new",
          ownerId: "user1",
          departmentId: "dept1",
          createdBy: "user1",
          sourceEntry: "workbench",
        });
      });

      const commentId = await t.run(async (ctx) => {
          return await (comments.create as any).handler(ctx, {
            projectId,
            authorId: "user1",
            body: "Just a regular comment",
            targetScope: "project",
          });
      });

      expect(commentId).toBeDefined();

      const mentions = await t.run(async (ctx) => {
        return await ctx.db
          .query("mentions")
          .withIndex("by_comment", (q) => q.eq("commentId", commentId))
          .collect();
      });

      expect(mentions.length).toBe(0);
    });

    it("should soft delete a comment correctly", async () => {
        const projectId = await t.run(async (ctx) => {
          return await ctx.db.insert("projects", {
            name: "Test Project",
            description: "Test",
            status: "new",
            ownerId: "user1",
            departmentId: "dept1",
            createdBy: "user1",
            sourceEntry: "workbench",
          });
        });

        const commentId = await t.run(async (ctx) => {
            return await (comments.create as any).handler(ctx, {
                projectId,
                authorId: "user1",
                body: "To be deleted",
                targetScope: "project",
            });
        });

        await t.run(async (ctx) => {
            return await (comments.softDelete as any).handler(ctx, {
                id: commentId,
                actorId: "user1",
            });
        });

        const comment = await t.run(async (ctx) => {
            return await ctx.db.get(commentId);
        });

        expect(comment).toBeDefined();
        expect(comment!.isDeleted).toBe(true);
        expect(comment!.deletedAt).toBeDefined();

        const auditEvents = await t.run(async (ctx) => {
            return await ctx.db.query("auditEvents").withIndex("by_project", q => q.eq("projectId", projectId)).collect();
        });

        expect(auditEvents.length).toBe(2);
        const deletedEvent = auditEvents.find(e => e.action === "comment.deleted");
        expect(deletedEvent).toBeDefined();
        expect(deletedEvent!.objectId).toBe(commentId);
    });
});
