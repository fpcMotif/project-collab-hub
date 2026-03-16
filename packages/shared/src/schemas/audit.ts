import { Schema } from "effect";

export class AuditEvent extends Schema.Class<AuditEvent>("AuditEvent")({
  action: Schema.String,
  actorId: Schema.String,
  changeSummary: Schema.String,
  decision: Schema.optionalWith(
    Schema.Literal("allowed", "rejected"),
    { as: "Option" }
  ),
  decisionReason: Schema.optionalWith(Schema.String, { as: "Option" }),
  fromStage: Schema.optionalWith(Schema.String, { as: "Option" }),
  id: Schema.String,
  idempotencyKey: Schema.optionalWith(Schema.String, { as: "Option" }),
  objectId: Schema.String,
  objectType: Schema.String,
  projectId: Schema.optionalWith(Schema.String, { as: "Option" }),
  sourceEntry: Schema.optionalWith(Schema.String, { as: "Option" }),
  toStage: Schema.optionalWith(Schema.String, { as: "Option" }),
}) {}
