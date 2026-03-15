import { Schema } from "effect";

export class FeishuTaskBinding extends Schema.Class<FeishuTaskBinding>(
  "FeishuTaskBinding",
)({
  id: Schema.String,
  workItemId: Schema.String,
  projectId: Schema.String,
  feishuTaskGuid: Schema.String,
  feishuTaskStatus: Schema.String,
  lastSyncedAt: Schema.DateFromNumber,
  syncDirection: Schema.Literal("app_created", "manual_link"),
}) {}

export class ChatBinding extends Schema.Class<ChatBinding>("ChatBinding")({
  id: Schema.String,
  projectId: Schema.String,
  feishuChatId: Schema.String,
  chatType: Schema.Literal("auto_created", "manual_bound"),
  botAddedAt: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  pinnedMessageId: Schema.optionalWith(Schema.String, { as: "Option" }),
}) {}

export class DocBinding extends Schema.Class<DocBinding>("DocBinding")({
  id: Schema.String,
  projectId: Schema.String,
  feishuDocToken: Schema.String,
  docType: Schema.Literal("doc", "wiki", "sheet", "base"),
  title: Schema.String,
  purpose: Schema.optionalWith(Schema.String, { as: "Option" }),
}) {}

export class BaseBinding extends Schema.Class<BaseBinding>("BaseBinding")({
  id: Schema.String,
  projectId: Schema.String,
  baseAppToken: Schema.String,
  tableId: Schema.String,
  recordId: Schema.String,
  fieldOwnership: Schema.optionalWith(Schema.String, { as: "Option" }),
  lastSyncedAt: Schema.DateFromNumber,
}) {}
