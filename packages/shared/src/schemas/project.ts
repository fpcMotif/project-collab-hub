import { Schema } from "effect";

export const ProjectStatus = Schema.Literal(
  "new",
  "assessment",
  "solution",
  "ready",
  "executing",
  "delivering",
  "done",
  "cancelled",
);
export type ProjectStatus = typeof ProjectStatus.Type;

export const SourceEntry = Schema.Literal(
  "workbench",
  "message_shortcut",
  "api",
);
export type SourceEntry = typeof SourceEntry.Type;

export class Project extends Schema.Class<Project>("Project")({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  status: ProjectStatus,
  ownerId: Schema.String,
  departmentId: Schema.String,
  customerName: Schema.optionalWith(Schema.String, { as: "Option" }),
  templateId: Schema.optionalWith(Schema.String, { as: "Option" }),
  templateVersion: Schema.optionalWith(Schema.Number, { as: "Option" }),
  priority: Schema.optionalWith(
    Schema.Literal("low", "medium", "high", "urgent"),
    { as: "Option" },
  ),
  startDate: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  endDate: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  slaDeadline: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  createdBy: Schema.String,
  sourceEntry: SourceEntry,
}) {}
