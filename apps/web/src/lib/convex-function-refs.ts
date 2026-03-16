import type { ProjectStatus } from "@collab-hub/shared";
import { makeFunctionReference } from "convex/server";

import type { BoardProjectRecord, Priority } from "@/features/board/types";
import type { ConvexProjectTemplateDoc } from "@/features/project-create/types";
import type { ProjectDetailData } from "@/features/project-detail/types";

export type ProjectDetailQueryArgs = Record<string, string> & {
  projectId: string;
};

export type TransitionProjectStageArgs = Record<string, string | undefined> & {
  projectId: string;
  targetStatus: ProjectStatus;
  actorId: string;
  reason?: string;
};

export interface TransitionProjectStageResult {
  ok: boolean;
  message?: string;
  status?: ProjectStatus;
}

export type UpdateWorkItemStatusArgs = Record<string, string> & {
  id: string;
  status: "todo" | "in_progress" | "in_review" | "done";
  actorId: string;
};

export type ResolveApprovalArgs = Record<string, string | undefined> & {
  id: string;
  instanceCode: string;
  status: "approved" | "rejected";
  resolvedBy: string;
  idempotencyKey?: string;
};

export type CreateCommentArgs = Record<string, string | string[] | undefined> & {
  projectId: string;
  authorId: string;
  body: string;
  targetScope: "project" | "department" | "work_item";
  departmentTrackId?: string;
  workItemId?: string;
  parentCommentId?: string;
  mentionedUserIds?: string[];
};

export type DeleteCommentArgs = Record<string, string> & {
  id: string;
  actorId: string;
};

export type ListProjectTemplatesArgs = Record<string, boolean | undefined> & {
  activeOnly?: boolean;
};

export interface CreateProjectFromTemplateArgs extends Record<string, string | number | undefined> {
  templateId: string;
  name: string;
  description: string;
  ownerId: string;
  departmentId: string;
  customerName?: string;
  priority?: Priority;
  startDate?: number;
  endDate?: number;
  slaDeadline?: number;
  createdBy: string;
  sourceEntry: "workbench" | "message_shortcut" | "api";
}

export interface CreateProjectFromTemplateResult {
  projectId: string;
  templateName: string;
  templateVersion: number;
}

export const convexFunctionRefs = {
  createComment: makeFunctionReference<"mutation", CreateCommentArgs, string>("comments:create"),
  createProjectFromTemplate: makeFunctionReference<
    "mutation",
    CreateProjectFromTemplateArgs,
    CreateProjectFromTemplateResult
  >("projects:createFromTemplate"),
  deleteComment: makeFunctionReference<"mutation", DeleteCommentArgs, undefined>(
    "comments:softDelete",
  ),
  getProjectDetail: makeFunctionReference<
    "query",
    ProjectDetailQueryArgs,
    ProjectDetailData | null
  >("board:getProjectDetail"),
  listBoardProjects: makeFunctionReference<"query", Record<string, never>, BoardProjectRecord[]>(
    "board:listBoardProjects",
  ),
  listProjectTemplates: makeFunctionReference<
    "query",
    ListProjectTemplatesArgs,
    ConvexProjectTemplateDoc[]
  >("projectTemplates:list"),
  resolveApprovalGate: makeFunctionReference<"mutation", ResolveApprovalArgs, undefined>(
    "approvalGates:resolve",
  ),
  transitionProjectStage: makeFunctionReference<
    "mutation",
    TransitionProjectStageArgs,
    TransitionProjectStageResult
  >("board:transitionProjectStage"),
  updateWorkItemStatus: makeFunctionReference<"mutation", UpdateWorkItemStatusArgs, undefined>(
    "workItems:updateStatus",
  ),
} as const;
