import { Schema } from "effect";

export const WorkItemStatus = Schema.Literal(
  "todo",
  "in_progress",
  "in_review",
  "done",
);
export type WorkItemStatus = typeof WorkItemStatus.Type;

export const WorkItemPriority = Schema.Literal(
  "low",
  "medium",
  "high",
  "urgent",
);
export type WorkItemPriority = typeof WorkItemPriority.Type;

export class WorkItem extends Schema.Class<WorkItem>("WorkItem")({
  id: Schema.String,
  projectId: Schema.String,
  departmentTrackId: Schema.optionalWith(Schema.String, { as: "Option" }),
  title: Schema.String,
  description: Schema.String,
  status: WorkItemStatus,
  priority: WorkItemPriority,
  assigneeId: Schema.optionalWith(Schema.String, { as: "Option" }),
  collaboratorIds: Schema.optionalWith(Schema.Array(Schema.String), {
    as: "Option",
  }),
  dueDate: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  completedAt: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
}) {}
