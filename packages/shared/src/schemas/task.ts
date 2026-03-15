import { Schema } from "effect";

export const TaskStatus = Schema.Literal(
  "todo",
  "in_progress",
  "in_review",
  "done",
);
export type TaskStatus = typeof TaskStatus.Type;

export const TaskPriority = Schema.Literal("low", "medium", "high", "urgent");
export type TaskPriority = typeof TaskPriority.Type;

export class Task extends Schema.Class<Task>("Task")({
  id: Schema.String,
  projectId: Schema.String,
  title: Schema.String,
  description: Schema.String,
  status: TaskStatus,
  priority: TaskPriority,
  assigneeId: Schema.optionalWith(Schema.String, { as: "Option" }),
  dueDate: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
}) {}
