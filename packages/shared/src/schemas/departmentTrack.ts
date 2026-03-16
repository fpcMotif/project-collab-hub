import { Schema } from "effect";

export const DepartmentTrackStatus = Schema.Literal(
  "not_required",
  "not_started",
  "in_progress",
  "blocked",
  "waiting_approval",
  "done"
);
export type DepartmentTrackStatus = typeof DepartmentTrackStatus.Type;

export class DepartmentTrack extends Schema.Class<DepartmentTrack>(
  "DepartmentTrack"
)({
  blockReason: Schema.optionalWith(Schema.String, { as: "Option" }),
  collaboratorIds: Schema.optionalWith(Schema.Array(Schema.String), {
    as: "Option",
  }),
  departmentId: Schema.String,
  departmentName: Schema.String,
  dueDate: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  id: Schema.String,
  isRequired: Schema.Boolean,
  ownerId: Schema.optionalWith(Schema.String, { as: "Option" }),
  projectId: Schema.String,
  status: DepartmentTrackStatus,
}) {}
