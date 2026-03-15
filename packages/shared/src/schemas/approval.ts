import { Schema } from "effect";

export const ApprovalStatus = Schema.Literal(
  "pending",
  "approved",
  "rejected",
  "cancelled",
);
export type ApprovalStatus = typeof ApprovalStatus.Type;

export class ApprovalGate extends Schema.Class<ApprovalGate>("ApprovalGate")({
  id: Schema.String,
  projectId: Schema.String,
  departmentTrackId: Schema.optionalWith(Schema.String, { as: "Option" }),
  triggerStage: Schema.String,
  approvalCode: Schema.String,
  instanceCode: Schema.optionalWith(Schema.String, { as: "Option" }),
  status: ApprovalStatus,
  title: Schema.String,
  applicantId: Schema.String,
  snapshotData: Schema.optionalWith(Schema.String, { as: "Option" }),
  templateVersion: Schema.optionalWith(Schema.Number, { as: "Option" }),
  resolvedAt: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  resolvedBy: Schema.optionalWith(Schema.String, { as: "Option" }),
}) {}
