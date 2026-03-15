import { Schema } from "effect";

export const DepartmentTrackStatus = Schema.Literal(
  "not_required",
  "not_started",
  "in_progress",
  "blocked",
  "waiting_approval",
  "done",
);
export type DepartmentTrackStatus = typeof DepartmentTrackStatus.Type;

export class DepartmentTrack extends Schema.Class<DepartmentTrack>(
  "DepartmentTrack",
)({
  id: Schema.String,
  projectId: Schema.String,
  departmentId: Schema.String,
  departmentName: Schema.String,
  isRequired: Schema.Boolean,
  status: DepartmentTrackStatus,
  ownerId: Schema.optionalWith(Schema.String, { as: "Option" }),
  collaboratorIds: Schema.optionalWith(Schema.Array(Schema.String), {
    as: "Option",
  }),
  dueDate: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  blockReason: Schema.optionalWith(Schema.String, { as: "Option" }),
}) {}
