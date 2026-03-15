import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const projectStatus = v.union(
  v.literal("new"),
  v.literal("assessment"),
  v.literal("solution"),
  v.literal("ready"),
  v.literal("executing"),
  v.literal("delivering"),
  v.literal("done"),
  v.literal("cancelled"),
);

const departmentTrackStatus = v.union(
  v.literal("not_required"),
  v.literal("not_started"),
  v.literal("in_progress"),
  v.literal("blocked"),
  v.literal("waiting_approval"),
  v.literal("done"),
);

const workItemStatus = v.union(
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("in_review"),
  v.literal("done"),
);

const workItemPriority = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent"),
);

const approvalStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("cancelled"),
);

export default defineSchema({
  // ── Core ──────────────────────────────────────────────────────────────

  projects: defineTable({
    name: v.string(),
    description: v.string(),
    status: projectStatus,
    ownerId: v.string(),
    departmentId: v.string(),
    customerName: v.optional(v.string()),
    templateId: v.optional(v.string()),
    templateVersion: v.optional(v.number()),
    priority: v.optional(workItemPriority),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    slaDeadline: v.optional(v.number()),
    createdBy: v.string(),
    sourceEntry: v.union(
      v.literal("workbench"),
      v.literal("message_shortcut"),
      v.literal("api"),
    ),
  })
    .index("by_status", ["status"])
    .index("by_owner", ["ownerId"])
    .index("by_department", ["departmentId"]),

  departmentTracks: defineTable({
    projectId: v.id("projects"),
    departmentId: v.string(),
    departmentName: v.string(),
    isRequired: v.boolean(),
    status: departmentTrackStatus,
    ownerId: v.optional(v.string()),
    collaboratorIds: v.optional(v.array(v.string())),
    dueDate: v.optional(v.number()),
    blockReason: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_department", ["departmentId"])
    .index("by_status", ["status"]),

  workItems: defineTable({
    projectId: v.id("projects"),
    departmentTrackId: v.optional(v.id("departmentTracks")),
    title: v.string(),
    description: v.string(),
    status: workItemStatus,
    priority: workItemPriority,
    assigneeId: v.optional(v.string()),
    collaboratorIds: v.optional(v.array(v.string())),
    dueDate: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_department_track", ["departmentTrackId"])
    .index("by_assignee", ["assigneeId"])
    .index("by_status", ["status"]),

  // ── Feishu Integration Bindings ───────────────────────────────────────

  approvalGates: defineTable({
    projectId: v.id("projects"),
    departmentTrackId: v.optional(v.id("departmentTracks")),
    triggerStage: projectStatus,
    approvalCode: v.string(),
    instanceCode: v.optional(v.string()),
    status: approvalStatus,
    title: v.string(),
    applicantId: v.string(),
    snapshotData: v.optional(v.string()),
    templateVersion: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_instance_code", ["instanceCode"])
    .index("by_status", ["status"]),

  feishuTaskBindings: defineTable({
    workItemId: v.id("workItems"),
    projectId: v.id("projects"),
    feishuTaskGuid: v.string(),
    feishuTaskStatus: v.string(),
    lastSyncedAt: v.number(),
    syncDirection: v.union(v.literal("app_created"), v.literal("manual_link")),
  })
    .index("by_work_item", ["workItemId"])
    .index("by_feishu_task", ["feishuTaskGuid"])
    .index("by_project", ["projectId"]),

  chatBindings: defineTable({
    projectId: v.id("projects"),
    feishuChatId: v.string(),
    chatType: v.union(v.literal("auto_created"), v.literal("manual_bound")),
    botAddedAt: v.optional(v.number()),
    pinnedMessageId: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_chat", ["feishuChatId"]),

  docBindings: defineTable({
    projectId: v.id("projects"),
    feishuDocToken: v.string(),
    docType: v.union(
      v.literal("doc"),
      v.literal("wiki"),
      v.literal("sheet"),
      v.literal("base"),
    ),
    title: v.string(),
    purpose: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_doc_token", ["feishuDocToken"]),

  baseBindings: defineTable({
    projectId: v.id("projects"),
    baseAppToken: v.string(),
    tableId: v.string(),
    recordId: v.string(),
    fieldOwnership: v.optional(v.string()),
    lastSyncedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_record", ["recordId"]),

  // ── Comments & Mentions ───────────────────────────────────────────────

  comments: defineTable({
    projectId: v.id("projects"),
    departmentTrackId: v.optional(v.id("departmentTracks")),
    workItemId: v.optional(v.id("workItems")),
    parentCommentId: v.optional(v.id("comments")),
    authorId: v.string(),
    body: v.string(),
    targetScope: v.union(
      v.literal("project"),
      v.literal("department"),
      v.literal("work_item"),
    ),
    isDeleted: v.boolean(),
    deletedAt: v.optional(v.number()),
    editedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_parent", ["parentCommentId"]),

  mentions: defineTable({
    commentId: v.id("comments"),
    projectId: v.id("projects"),
    mentionedUserId: v.string(),
    mentionedByUserId: v.string(),
    notificationSent: v.boolean(),
    notificationDeliveryId: v.optional(v.id("notificationDeliveries")),
  })
    .index("by_comment", ["commentId"])
    .index("by_mentioned_user", ["mentionedUserId"]),

  notificationDeliveries: defineTable({
    projectId: v.id("projects"),
    recipientId: v.string(),
    channel: v.union(
      v.literal("group_chat"),
      v.literal("private_chat"),
      v.literal("batch_message"),
    ),
    messageType: v.union(
      v.literal("mention"),
      v.literal("approval_result"),
      v.literal("task_update"),
      v.literal("stage_change"),
      v.literal("risk_alert"),
    ),
    feishuMessageId: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("retrying"),
    ),
    retryCount: v.number(),
    lastError: v.optional(v.string()),
    payload: v.string(),
  })
    .index("by_project", ["projectId"])
    .index("by_recipient", ["recipientId"])
    .index("by_status", ["status"]),

  // ── Audit & Events ────────────────────────────────────────────────────

  auditEvents: defineTable({
    projectId: v.optional(v.id("projects")),
    actorId: v.string(),
    action: v.string(),
    objectType: v.string(),
    objectId: v.string(),
    changeSummary: v.string(),
    sourceEntry: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_actor", ["actorId"])
    .index("by_idempotency_key", ["idempotencyKey"]),
});
