import { Schema } from "effect";

export const ProjectStatus = Schema.Literal(
  "new",
  "assessment",
  "solution",
  "ready",
  "executing",
  "delivering",
  "done",
  "cancelled"
);
export type ProjectStatus = typeof ProjectStatus.Type;

export const SourceEntry = Schema.Literal(
  "workbench",
  "message_shortcut",
  "api"
);
export type SourceEntry = typeof SourceEntry.Type;

export class Project extends Schema.Class<Project>("Project")({
  createdBy: Schema.String,
  customerName: Schema.optionalWith(Schema.String, { as: "Option" }),
  departmentId: Schema.String,
  description: Schema.String,
  endDate: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  id: Schema.String,
  name: Schema.String,
  ownerId: Schema.String,
  priority: Schema.optionalWith(
    Schema.Literal("low", "medium", "high", "urgent"),
    { as: "Option" }
  ),
  slaDeadline: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  sourceEntry: SourceEntry,
  startDate: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  status: ProjectStatus,
  templateId: Schema.optionalWith(Schema.String, { as: "Option" }),
  templateVersion: Schema.optionalWith(Schema.Number, { as: "Option" }),
}) {}
