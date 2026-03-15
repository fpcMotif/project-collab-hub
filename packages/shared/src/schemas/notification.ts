import { Schema } from "effect";

export const NotificationChannel = Schema.Literal(
  "group_chat",
  "private_chat",
  "batch_message",
);
export type NotificationChannel = typeof NotificationChannel.Type;

export const NotificationMessageType = Schema.Literal(
  "mention",
  "approval_result",
  "task_update",
  "stage_change",
  "risk_alert",
);
export type NotificationMessageType = typeof NotificationMessageType.Type;

export const NotificationStatus = Schema.Literal(
  "pending",
  "sending",
  "sent",
  "failed",
  "retrying",
);
export type NotificationStatus = typeof NotificationStatus.Type;

export class NotificationDelivery extends Schema.Class<NotificationDelivery>(
  "NotificationDelivery",
)({
  id: Schema.String,
  projectId: Schema.String,
  recipientId: Schema.String,
  channel: NotificationChannel,
  messageType: NotificationMessageType,
  feishuMessageId: Schema.optionalWith(Schema.String, { as: "Option" }),
  status: NotificationStatus,
  retryCount: Schema.Number,
  lastError: Schema.optionalWith(Schema.String, { as: "Option" }),
}) {}
