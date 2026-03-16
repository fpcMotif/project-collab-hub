import { Schema } from "effect";

export const ApprovalStatus = Schema.Literal(
  "pending",
  "approved",
  "rejected",
  "cancelled"
);
export type ApprovalStatus = typeof ApprovalStatus.Type;

export class ApprovalGate extends Schema.Class<ApprovalGate>("ApprovalGate")({
  applicantId: Schema.String,
  approvalCode: Schema.String,
  departmentTrackId: Schema.optionalWith(Schema.String, { as: "Option" }),
  id: Schema.String,
  instanceCode: Schema.optionalWith(Schema.String, { as: "Option" }),
  projectId: Schema.String,
  resolvedAt: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  resolvedBy: Schema.optionalWith(Schema.String, { as: "Option" }),
  snapshotData: Schema.optionalWith(Schema.String, { as: "Option" }),
  status: ApprovalStatus,
  templateVersion: Schema.optionalWith(Schema.Number, { as: "Option" }),
  title: Schema.String,
  triggerStage: Schema.String,
}) {}
