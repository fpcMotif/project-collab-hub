/* eslint-disable max-classes-per-file */
import { Schema } from "effect";

export const CommentTargetScope = Schema.Literal(
  "project",
  "department",
  "work_item"
);
export type CommentTargetScope = typeof CommentTargetScope.Type;

export class Comment extends Schema.Class<Comment>("Comment")({
  authorId: Schema.String,
  body: Schema.String,
  deletedAt: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  departmentTrackId: Schema.optionalWith(Schema.String, { as: "Option" }),
  editedAt: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
  id: Schema.String,
  isDeleted: Schema.Boolean,
  parentCommentId: Schema.optionalWith(Schema.String, { as: "Option" }),
  projectId: Schema.String,
  targetScope: CommentTargetScope,
  workItemId: Schema.optionalWith(Schema.String, { as: "Option" }),
}) {}

export class Mention extends Schema.Class<Mention>("Mention")({
  commentId: Schema.String,
  id: Schema.String,
  mentionedByUserId: Schema.String,
  mentionedUserId: Schema.String,
  notificationSent: Schema.Boolean,
  projectId: Schema.String,
}) {}
