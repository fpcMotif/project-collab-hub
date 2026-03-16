import { getColumnNameByStatus } from "@/features/board/lib/view-model";
import type { BoardProjectRecord } from "@/features/board/types";

import type {
  ProjectDetailApproval,
  ProjectDetailComment,
  ProjectDetailData,
  ProjectDetailDepartmentTrack,
  ProjectDetailTimelineEvent,
  ProjectDetailWorkItem,
} from "./types";

const buildDepartmentTracks = (
  project: BoardProjectRecord
): ProjectDetailDepartmentTrack[] =>
  project.departmentTracks.map((track, index) => ({
    blockReason: track.blockReason,
    collaboratorIds:
      project.ownerName === "未分配" ? [] : [`协作人-${index + 1}`],
    departmentId: `dept-${index + 1}`,
    departmentName: track.departmentName,
    dueDate: Date.now() + (index + 1) * 1000 * 60 * 60 * 24,
    id: `${project.id}-track-${index + 1}`,
    isRequired: track.status !== "not_required",
    ownerId: project.ownerName === "未分配" ? undefined : project.ownerName,
    pendingApprovalCount: track.status === "waiting_approval" ? 1 : 0,
    relatedWorkItemCount: track.status === "not_required" ? 0 : index + 1,
    status: track.status,
  }));

const mapTrackStatusToWorkItemStatus = (
  trackStatus: string
): "done" | "in_progress" | "in_review" | "todo" => {
  if (trackStatus === "done") {
    return "done";
  }
  if (trackStatus === "in_progress") {
    return "in_progress";
  }
  if (trackStatus === "waiting_approval") {
    return "in_review";
  }
  return "todo";
};

const buildWorkItems = (
  project: BoardProjectRecord,
  departmentTracks: ProjectDetailDepartmentTrack[]
): ProjectDetailWorkItem[] =>
  departmentTracks
    .filter((track) => track.isRequired)
    .slice(0, 3)
    .map((track, index) => ({
      assigneeId: track.ownerId,
      collaboratorIds: track.collaboratorIds,
      completedAt:
        track.status === "done" ? Date.now() - 1000 * 60 * 60 * 6 : undefined,
      departmentName: track.departmentName,
      departmentTrackId: track.id,
      description: `${project.name} - ${track.departmentName}执行项`,
      dueDate: track.dueDate,
      feishuTaskGuid: `task-${project.id}-${index + 1}`,
      feishuTaskStatus: track.status === "done" ? "COMPLETED" : "ACTIVE",
      id: `${project.id}-work-${index + 1}`,
      priority: index === 0 ? project.priority : "medium",
      status: mapTrackStatusToWorkItemStatus(track.status),
      title: `${track.departmentName}任务 ${index + 1}`,
    }));

const buildApprovals = (
  project: BoardProjectRecord,
  departmentTracks: ProjectDetailDepartmentTrack[]
): ProjectDetailApproval[] => {
  const pendingDepartment = departmentTracks.find(
    (track) => track.pendingApprovalCount > 0
  );

  return [
    {
      applicantId: project.ownerName,
      approvalCode: "APPROVAL_PROJECT_START",
      departmentName: pendingDepartment?.departmentName ?? null,
      id: `${project.id}-approval-1`,
      instanceCode:
        project.pendingApprovalCount > 0
          ? `INST-${project.id}-1`
          : `INST-${project.id}-0`,
      resolvedAt:
        project.pendingApprovalCount > 0
          ? undefined
          : Date.now() - 1000 * 60 * 60 * 12,
      resolvedBy: project.pendingApprovalCount > 0 ? null : "审批人-01",
      status: project.pendingApprovalCount > 0 ? "pending" : "approved",
      title: `${project.name} 启动审批`,
      triggerStage: project.status,
    },
  ];
};

const buildComments = (project: BoardProjectRecord): ProjectDetailComment[] => [
  {
    authorId: project.ownerName,
    body: `已同步 ${project.name} 的当前阶段和风险信息。`,
    createdAt: Date.now() - 1000 * 60 * 60 * 8,
    id: `${project.id}-comment-1`,
    isDeleted: false,
    mentionedUserIds: project.ownerName === "未分配" ? [] : [project.ownerName],
    parentCommentId: null,
    targetScope: "project",
  },
  {
    authorId: "PMO-值班",
    body:
      project.pendingApprovalCount > 0
        ? "审批仍在处理中，请相关同事关注飞书审批通知。"
        : "如无新增阻塞，可按计划推进下一阶段。",
    createdAt: Date.now() - 1000 * 60 * 60 * 3,
    id: `${project.id}-comment-2`,
    isDeleted: false,
    mentionedUserIds: project.ownerName === "未分配" ? [] : [project.ownerName],
    parentCommentId: null,
    targetScope: "project",
  },
];

const buildTimeline = (
  project: BoardProjectRecord
): ProjectDetailTimelineEvent[] => [
  {
    action: "project.created",
    actorId: project.ownerName,
    changeSummary: `${project.name} 已创建并进入 ${getColumnNameByStatus(project.status) ?? project.status}`,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    id: `${project.id}-timeline-1`,
    objectId: project.id,
    objectType: "project",
    sourceEntry: "workbench",
  },
  {
    action: "project.stage_reviewed",
    actorId: "web_app.board_drag_drop",
    changeSummary: `当前阶段：${getColumnNameByStatus(project.status) ?? project.status}`,
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
    id: `${project.id}-timeline-2`,
    objectId: project.id,
    objectType: "project",
    sourceEntry: "board",
  },
];

export const createInitialMockProjectDetail = (
  project: BoardProjectRecord
): ProjectDetailData => {
  const departmentTracks = buildDepartmentTracks(project);

  return {
    approvals: buildApprovals(project, departmentTracks),
    bindings: {
      bases: [
        {
          baseAppToken: `bascn_${project.id.toLowerCase()}`,
          fieldOwnership: "App-owned",
          id: `${project.id}-base-1`,
          lastSyncedAt: Date.now() - 1000 * 60 * 30,
          recordId: `rec_${project.id.toLowerCase()}`,
          tableId: "tblProjects",
        },
      ],
      chats: [
        {
          chatType: "manual_bound",
          feishuChatId: `oc_${project.id.toLowerCase()}`,
          id: `${project.id}-chat-1`,
          pinnedMessageId: `om_${project.id.toLowerCase()}`,
        },
      ],
      docs: [
        {
          docType: "doc",
          feishuDocToken: `doc_${project.id.toLowerCase()}`,
          id: `${project.id}-doc-1`,
          purpose: "方案沉淀",
          title: `${project.name} 项目方案`,
        },
        {
          docType: "wiki",
          feishuDocToken: `wiki_${project.id.toLowerCase()}`,
          id: `${project.id}-doc-2`,
          purpose: "交付资料",
          title: `${project.name} 交付清单`,
        },
      ],
    },
    comments: buildComments(project),
    departmentTracks,
    project: {
      ...project,
      createdBy: "系统演示账号",
      description: `${project.name} 的项目详情页示例，当前用于验证飞书协同项目台的前端结构。`,
      endDate: Date.now() + 1000 * 60 * 60 * 24 * 14,
      slaDeadline: Date.now() + 1000 * 60 * 60 * 24 * 7,
      sourceEntry: "workbench",
      startDate: Date.now() - 1000 * 60 * 60 * 24 * 3,
    },
    timeline: buildTimeline(project),
    workItems: buildWorkItems(project, departmentTracks),
  };
};

export const getMockProjectDetail = (
  projectId: string,
  projects: BoardProjectRecord[]
): ProjectDetailData | null => {
  const project = projects.find((item) => item.id === projectId);
  if (!project) {
    return null;
  }

  return createInitialMockProjectDetail(project);
};
