import { Schema } from "effect";

export const WorkItemStatus = Schema.Literal(
  "todo",
  "in_progress",
  "in_review",
  "done"
);
export type WorkItemStatus = typeof WorkItemStatus.Type;

export const WorkItemPriority = Schema.Literal(
  "low",
  "medium",
  "high",
  "urgent"
);
export type WorkItemPriority = typeof WorkItemPriority.Type;

export class WorkItem extends Schema.Class<WorkItem>("WorkItem")({
  assigneeId: Schema.optionalWith(Schema.String, { as: "Option" }),
  collaboratorIds: Schema.optionalWith(Schema.Array(Schema.String), {
    as: "Option",
  }),
  completedAt: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  departmentTrackId: Schema.optionalWith(Schema.String, { as: "Option" }),
  description: Schema.String,
  dueDate: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  id: Schema.String,
  priority: WorkItemPriority,
  projectId: Schema.String,
  status: WorkItemStatus,
  title: Schema.String,
}) {}
