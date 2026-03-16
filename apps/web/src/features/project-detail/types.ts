import type { CommentTargetScope } from "@collab-hub/shared";

import type { BoardProjectRecord, DeptTrackStatus, Priority } from "@/features/board/types";

export type WorkItemStatus = "todo" | "in_progress" | "in_review" | "done";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";
export type DocType = "doc" | "wiki" | "sheet" | "base";

export interface ProjectDetailProject extends BoardProjectRecord {
  description: string;
  createdBy: string;
  sourceEntry: string;
  startDate?: number;
  endDate?: number;
  slaDeadline?: number;
}

export interface ProjectDetailDepartmentTrack {
  id: string;
  departmentId: string;
  departmentName: string;
  isRequired: boolean;
  status: DeptTrackStatus;
  ownerId?: string;
  collaboratorIds: string[];
  dueDate?: number;
  blockReason?: string;
  relatedWorkItemCount: number;
  pendingApprovalCount: number;
}

export interface ProjectDetailWorkItem {
  id: string;
  title: string;
  description: string;
  status: WorkItemStatus;
  priority: Priority;
  assigneeId?: string;
  collaboratorIds: string[];
  dueDate?: number;
  completedAt?: number;
  departmentTrackId?: string;
  departmentName?: string | null;
  feishuTaskGuid?: string | null;
  feishuTaskStatus?: string | null;
}

export interface ProjectDetailApproval {
  id: string;
  title: string;
  triggerStage: string;
  status: ApprovalStatus;
  approvalCode: string;
  instanceCode?: string | null;
  applicantId: string;
  resolvedAt?: number;
  resolvedBy?: string | null;
  departmentName?: string | null;
}

export interface ProjectDetailComment {
  id: string;
  authorId: string;
  body: string;
  targetScope: CommentTargetScope;
  isDeleted: boolean;
  parentCommentId?: string | null;
  mentionedUserIds: string[];
  createdAt: number;
}

export interface ProjectDetailTimelineEvent {
  id: string;
  actorId: string;
  action: string;
  objectType: string;
  objectId: string;
  changeSummary: string;
  sourceEntry?: string;
  createdAt: number;
}

export interface ProjectDetailChatBinding {
  id: string;
  feishuChatId: string;
  chatType: string;
  pinnedMessageId?: string;
}

export interface ProjectDetailDocBinding {
  id: string;
  title: string;
  docType: DocType;
  purpose?: string;
  feishuDocToken: string;
}

export interface ProjectDetailBaseBinding {
  id: string;
  baseAppToken: string;
  tableId: string;
  recordId: string;
  fieldOwnership?: string;
  lastSyncedAt: number;
}

export interface ProjectDetailData {
  project: ProjectDetailProject;
  departmentTracks: ProjectDetailDepartmentTrack[];
  workItems: ProjectDetailWorkItem[];
  approvals: ProjectDetailApproval[];
  comments: ProjectDetailComment[];
  timeline: ProjectDetailTimelineEvent[];
  bindings: {
    chats: ProjectDetailChatBinding[];
    docs: ProjectDetailDocBinding[];
    bases: ProjectDetailBaseBinding[];
  };
}
