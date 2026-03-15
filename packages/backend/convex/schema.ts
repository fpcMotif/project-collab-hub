import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  projects: defineTable({
    name: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("planning"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("archived"),
    ),
    ownerId: v.string(),
    departmentId: v.string(),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_owner", ["ownerId"])
    .index("by_department", ["departmentId"]),

  tasks: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("in_review"),
      v.literal("done"),
    ),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent"),
    ),
    assigneeId: v.optional(v.string()),
    dueDate: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_assignee", ["assigneeId"])
    .index("by_status", ["status"]),
});
