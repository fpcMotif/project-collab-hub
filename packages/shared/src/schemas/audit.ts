import { Schema } from "effect";

export class AuditEvent extends Schema.Class<AuditEvent>("AuditEvent")({
  id: Schema.String,
  projectId: Schema.optionalWith(Schema.String, { as: "Option" }),
  actorId: Schema.String,
  action: Schema.String,
  objectType: Schema.String,
  objectId: Schema.String,
  changeSummary: Schema.String,
  sourceEntry: Schema.optionalWith(Schema.String, { as: "Option" }),
  idempotencyKey: Schema.optionalWith(Schema.String, { as: "Option" }),
}) {}
