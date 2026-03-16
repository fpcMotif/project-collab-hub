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
  v.literal("cancelled")
);

const departmentTrackStatus = v.union(
  v.literal("not_required"),
  v.literal("not_started"),
  v.literal("in_progress"),
  v.literal("blocked"),
  v.literal("waiting_approval"),
  v.literal("done")
);

const workItemStatus = v.union(
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("in_review"),
  v.literal("done")
);

const workItemPriority = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent")
);

const approvalStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("cancelled")
);

export default defineSchema({
  approvalGates: defineTable({
    applicantId: v.string(),
    approvalCode: v.string(),
    departmentTrackId: v.optional(v.id("departmentTracks")),
    instanceCode: v.optional(v.string()),
    projectId: v.id("projects"),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.string()),
    snapshotData: v.optional(v.string()),
    status: approvalStatus,
    templateVersion: v.optional(v.number()),
    title: v.string(),
    triggerStage: projectStatus,
  })
    .index("by_project", ["projectId"])
    .index("by_instance_code", ["instanceCode"])
    .index("by_status", ["status"]),

  auditEvents: defineTable({
    action: v.string(),
    actorId: v.string(),
    changeSummary: v.string(),
    idempotencyKey: v.optional(v.string()),
    objectId: v.string(),
    objectType: v.string(),
    projectId: v.optional(v.id("projects")),
    sourceEntry: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_actor", ["actorId"])
    .index("by_idempotency_key", ["idempotencyKey"]),

  baseBindings: defineTable({
    baseAppToken: v.string(),
    fieldOwnership: v.optional(v.string()),
    lastSyncedAt: v.number(),
    projectId: v.id("projects"),
    recordId: v.string(),
    tableId: v.string(),
  })
    .index("by_project", ["projectId"])
    .index("by_record", ["recordId"]),

  chatBindings: defineTable({
    botAddedAt: v.optional(v.number()),
    chatType: v.union(v.literal("auto_created"), v.literal("manual_bound")),
    feishuChatId: v.string(),
    pinnedMessageId: v.optional(v.string()),
    projectId: v.id("projects"),
  })
    .index("by_project", ["projectId"])
    .index("by_chat", ["feishuChatId"]),

  comments: defineTable({
    authorId: v.string(),
    body: v.string(),
    deletedAt: v.optional(v.number()),
    departmentTrackId: v.optional(v.id("departmentTracks")),
    editedAt: v.optional(v.number()),
    isDeleted: v.boolean(),
    parentCommentId: v.optional(v.id("comments")),
    projectId: v.id("projects"),
    targetScope: v.union(
      v.literal("project"),
      v.literal("department"),
      v.literal("work_item")
    ),
    workItemId: v.optional(v.id("workItems")),
  })
    .index("by_project", ["projectId"])
    .index("by_parent", ["parentCommentId"]),

  departmentTracks: defineTable({
    blockReason: v.optional(v.string()),
    collaboratorIds: v.optional(v.array(v.string())),
    departmentId: v.string(),
    departmentName: v.string(),
    dueDate: v.optional(v.number()),
    isRequired: v.boolean(),
    ownerId: v.optional(v.string()),
    projectId: v.id("projects"),
    status: departmentTrackStatus,
  })
    .index("by_project", ["projectId"])
    .index("by_department", ["departmentId"])
    .index("by_status", ["status"]),

  docBindings: defineTable({
    docType: v.union(
      v.literal("doc"),
      v.literal("wiki"),
      v.literal("sheet"),
      v.literal("base")
    ),
    feishuDocToken: v.string(),
    projectId: v.id("projects"),
    purpose: v.optional(v.string()),
    title: v.string(),
  })
    .index("by_project", ["projectId"])
    .index("by_doc_token", ["feishuDocToken"]),

  feishuTaskBindings: defineTable({
    feishuTaskGuid: v.string(),
    feishuTaskStatus: v.string(),
    lastSyncedAt: v.number(),
    projectId: v.id("projects"),
    syncDirection: v.union(v.literal("app_created"), v.literal("manual_link")),
    workItemId: v.id("workItems"),
  })
    .index("by_work_item", ["workItemId"])
    .index("by_feishu_task", ["feishuTaskGuid"])
    .index("by_project", ["projectId"]),

  mentions: defineTable({
    commentId: v.id("comments"),
    mentionedByUserId: v.string(),
    mentionedUserId: v.string(),
    notificationDeliveryId: v.optional(v.id("notificationDeliveries")),
    notificationSent: v.boolean(),
    projectId: v.id("projects"),
  })
    .index("by_comment", ["commentId"])
    .index("by_mentioned_user", ["mentionedUserId"]),

  notificationDeliveries: defineTable({
    channel: v.union(
      v.literal("group_chat"),
      v.literal("private_chat"),
      v.literal("batch_message")
    ),
    feishuMessageId: v.optional(v.string()),
    lastError: v.optional(v.string()),
    messageType: v.union(
      v.literal("mention"),
      v.literal("approval_result"),
      v.literal("task_update"),
      v.literal("stage_change"),
      v.literal("risk_alert")
    ),
    payload: v.string(),
    projectId: v.id("projects"),
    recipientId: v.string(),
    retryCount: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("retrying")
    ),
  })
    .index("by_project", ["projectId"])
    .index("by_recipient", ["recipientId"])
    .index("by_status", ["status"]),

  projectTemplates: defineTable({
    approvalGates: v.array(
      v.object({
        approvalCode: v.string(),
        isRequired: v.boolean(),
        title: v.string(),
        triggerStage: v.string(),
      })
    ),
    chatPolicy: v.object({
      addBotAsManager: v.boolean(),
      autoCreateChat: v.boolean(),
      chatNameTemplate: v.optional(v.string()),
      pinProjectCard: v.boolean(),
    }),
    createdBy: v.string(),
    defaultPriority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    departments: v.array(
      v.object({
        defaultOwnerId: v.optional(v.string()),
        departmentId: v.string(),
        departmentName: v.string(),
        isRequired: v.boolean(),
      })
    ),
    description: v.string(),
    isActive: v.boolean(),
    name: v.string(),
    notificationRules: v.array(
      v.object({
        channel: v.string(),
        enabled: v.boolean(),
        event: v.string(),
        recipientStrategy: v.string(),
      })
    ),
    updatedAt: v.number(),
    version: v.number(),
  })
    .index("by_active", ["isActive"])
    .index("by_name", ["name"]),

  projects: defineTable({
    createdBy: v.string(),
    customerName: v.optional(v.string()),
    departmentId: v.string(),
    description: v.string(),
    endDate: v.optional(v.number()),
    name: v.string(),
    ownerId: v.string(),
    priority: v.optional(workItemPriority),
    slaDeadline: v.optional(v.number()),
    sourceEntry: v.union(
      v.literal("workbench"),
      v.literal("message_shortcut"),
      v.literal("api")
    ),
    startDate: v.optional(v.number()),
    status: projectStatus,
    templateId: v.optional(v.string()),
    templateVersion: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_owner", ["ownerId"])
    .index("by_department", ["departmentId"]),

  workItems: defineTable({
    assigneeId: v.optional(v.string()),
    collaboratorIds: v.optional(v.array(v.string())),
    completedAt: v.optional(v.number()),
    departmentTrackId: v.optional(v.id("departmentTracks")),
    description: v.string(),
    dueDate: v.optional(v.number()),
    priority: workItemPriority,
    projectId: v.id("projects"),
    status: workItemStatus,
    title: v.string(),
  })
    .index("by_project", ["projectId"])
    .index("by_department_track", ["departmentTrackId"])
    .index("by_assignee", ["assigneeId"])
    .index("by_status", ["status"]),
});
