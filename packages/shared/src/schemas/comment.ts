import { Schema } from "effect";

export const CommentTargetScope = Schema.Literal(
  "project",
  "department",
  "work_item",
);
export type CommentTargetScope = typeof CommentTargetScope.Type;

export class Comment extends Schema.Class<Comment>("Comment")({
  id: Schema.String,
  projectId: Schema.String,
  departmentTrackId: Schema.optionalWith(Schema.String, { as: "Option" }),
  workItemId: Schema.optionalWith(Schema.String, { as: "Option" }),
  parentCommentId: Schema.optionalWith(Schema.String, { as: "Option" }),
  authorId: Schema.String,
  body: Schema.String,
  targetScope: CommentTargetScope,
  isDeleted: Schema.Boolean,
  deletedAt: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  editedAt: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
}) {}

export class Mention extends Schema.Class<Mention>("Mention")({
  id: Schema.String,
  commentId: Schema.String,
  projectId: Schema.String,
  mentionedUserId: Schema.String,
  mentionedByUserId: Schema.String,
  notificationSent: Schema.Boolean,
}) {}
