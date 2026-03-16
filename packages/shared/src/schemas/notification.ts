import { Schema } from "effect";

export const NotificationChannel = Schema.Literal(
  "group_chat",
  "private_chat",
  "batch_message"
);
export type NotificationChannel = typeof NotificationChannel.Type;

export const NotificationMessageType = Schema.Literal(
  "mention",
  "approval_result",
  "task_update",
  "stage_change",
  "risk_alert"
);
export type NotificationMessageType = typeof NotificationMessageType.Type;

export const NotificationStatus = Schema.Literal(
  "pending",
  "sending",
  "sent",
  "failed",
  "retrying"
);
export type NotificationStatus = typeof NotificationStatus.Type;

export class NotificationDelivery extends Schema.Class<NotificationDelivery>(
  "NotificationDelivery"
)({
  channel: NotificationChannel,
  feishuMessageId: Schema.optionalWith(Schema.String, { as: "Option" }),
  id: Schema.String,
  lastError: Schema.optionalWith(Schema.String, { as: "Option" }),
  messageType: NotificationMessageType,
  projectId: Schema.String,
  recipientId: Schema.String,
  retryCount: Schema.Number,
  status: NotificationStatus,
}) {}
