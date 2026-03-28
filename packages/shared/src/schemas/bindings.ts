import { Schema } from "effect";

export class FeishuTaskBinding extends Schema.Class<FeishuTaskBinding>(
  "FeishuTaskBinding"
)({
  feishuTaskGuid: Schema.String,
  feishuTaskStatus: Schema.String,
  id: Schema.String,
  lastSyncedAt: Schema.DateFromNumber,
  projectId: Schema.String,
  syncDirection: Schema.Literal("app_created", "manual_link"),
  workItemId: Schema.String,
}) {}

export class ChatBinding extends Schema.Class<ChatBinding>("ChatBinding")({
  botAddedAt: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  chatType: Schema.Literal("auto_created", "manual_bound"),
  feishuChatId: Schema.String,
  id: Schema.String,
  pinnedMessageId: Schema.optionalWith(Schema.String, { as: "Option" }),
  projectId: Schema.String,
}) {}

export class DocBinding extends Schema.Class<DocBinding>("DocBinding")({
  docType: Schema.Literal("doc", "wiki", "sheet", "base"),
  feishuDocToken: Schema.String,
  id: Schema.String,
  projectId: Schema.String,
  purpose: Schema.optionalWith(Schema.String, { as: "Option" }),
  title: Schema.String,
}) {}

export class BaseBinding extends Schema.Class<BaseBinding>("BaseBinding")({
  baseAppToken: Schema.String,
  fieldOwnership: Schema.optionalWith(Schema.String, { as: "Option" }),
  id: Schema.String,
  lastSyncedAt: Schema.DateFromNumber,
  projectId: Schema.String,
  recordId: Schema.String,
  tableId: Schema.String,
}) {}

export class WorkflowInstance extends Schema.Class<WorkflowInstance>(
  "WorkflowInstance"
)({
  feishuInstanceCode: Schema.String,
  feishuWorkflowCode: Schema.String,
  id: Schema.String,
  lastPolledAt: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  nodeCallbackData: Schema.optionalWith(Schema.String, { as: "Option" }),
  projectId: Schema.String,
  resolvedAt: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  resolvedBy: Schema.optionalWith(Schema.String, { as: "Option" }),
  status: Schema.Literal(
    "pending",
    "running",
    "approved",
    "rejected",
    "cancelled",
    "error"
  ),
  triggerStage: Schema.optionalWith(Schema.String, { as: "Option" }),
  triggeredBy: Schema.String,
}) {}
