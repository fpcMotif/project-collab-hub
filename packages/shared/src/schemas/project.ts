import { Schema } from "effect";

export const ProjectStatus = Schema.Literal(
  "planning",
  "in_progress",
  "completed",
  "archived",
);
export type ProjectStatus = typeof ProjectStatus.Type;

export class Project extends Schema.Class<Project>("Project")({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  status: ProjectStatus,
  ownerId: Schema.String,
  departmentId: Schema.String,
  startDate: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  endDate: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
}) {}
