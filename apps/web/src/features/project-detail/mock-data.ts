import type { BoardProjectRecord } from "@/features/board/types";
import { getColumnNameByStatus } from "@/features/board/lib/view-model";
import type {
  ProjectDetailApproval,
  ProjectDetailComment,
  ProjectDetailData,
  ProjectDetailDepartmentTrack,
  ProjectDetailTimelineEvent,
  ProjectDetailWorkItem,
} from "./types";

function buildDepartmentTracks(project: BoardProjectRecord): ProjectDetailDepartmentTrack[] {
  return project.departmentTracks.map((track, index) => ({
    id: `${project.id}-track-${index + 1}`,
    departmentId: `dept-${index + 1}`,
    departmentName: track.departmentName,
    isRequired: track.status !== "not_required",
    status: track.status,
    ownerId: project.ownerName === "未分配" ? undefined : project.ownerName,
    collaboratorIds: project.ownerName === "未分配" ? [] : [`协作人-${index + 1}`],
    dueDate: Date.now() + (index + 1) * 1000 * 60 * 60 * 24,
    blockReason: track.blockReason,
    relatedWorkItemCount: track.status === "not_required" ? 0 : index + 1,
    pendingApprovalCount: track.status === "waiting_approval" ? 1 : 0,
  }));
}

function buildWorkItems(
  project: BoardProjectRecord,
  departmentTracks: ProjectDetailDepartmentTrack[],
): ProjectDetailWorkItem[] {
  return departmentTracks
    .filter((track) => track.isRequired)
    .slice(0, 3)
    .map((track, index) => ({
      id: `${project.id}-work-${index + 1}`,
      title: `${track.departmentName}任务 ${index + 1}`,
      description: `${project.name} - ${track.departmentName}执行项`,
      status:
        track.status === "done"
          ? "done"
          : track.status === "in_progress"
            ? "in_progress"
            : track.status === "waiting_approval"
              ? "in_review"
              : "todo",
      priority: index === 0 ? project.priority : "medium",
      assigneeId: track.ownerId,
      collaboratorIds: track.collaboratorIds,
      dueDate: track.dueDate,
      completedAt: track.status === "done" ? Date.now() - 1000 * 60 * 60 * 6 : undefined,
      departmentTrackId: track.id,
      departmentName: track.departmentName,
      feishuTaskGuid: `task-${project.id}-${index + 1}`,
      feishuTaskStatus: track.status === "done" ? "COMPLETED" : "ACTIVE",
    }));
}

function buildApprovals(
  project: BoardProjectRecord,
  departmentTracks: ProjectDetailDepartmentTrack[],
): ProjectDetailApproval[] {
  const pendingDepartment = departmentTracks.find(
    (track) => track.pendingApprovalCount > 0,
  );

  return [
    {
      id: `${project.id}-approval-1`,
      title: `${project.name} 启动审批`,
      triggerStage: project.status,
      status: project.pendingApprovalCount > 0 ? "pending" : "approved",
      approvalCode: "APPROVAL_PROJECT_START",
      instanceCode: project.pendingApprovalCount > 0 ? `INST-${project.id}-1` : `INST-${project.id}-0`,
      applicantId: project.ownerName,
      resolvedAt: project.pendingApprovalCount > 0 ? undefined : Date.now() - 1000 * 60 * 60 * 12,
      resolvedBy: project.pendingApprovalCount > 0 ? null : "审批人-01",
      departmentName: pendingDepartment?.departmentName ?? null,
    },
  ];
}

function buildComments(project: BoardProjectRecord): ProjectDetailComment[] {
  return [
    {
      id: `${project.id}-comment-1`,
      authorId: project.ownerName,
      body: `已同步 ${project.name} 的当前阶段和风险信息。`,
      targetScope: "project",
      isDeleted: false,
      mentionedUserIds: project.ownerName === "未分配" ? [] : [project.ownerName],
      createdAt: Date.now() - 1000 * 60 * 60 * 8,
      parentCommentId: null,
    },
    {
      id: `${project.id}-comment-2`,
      authorId: "PMO-值班",
      body:
        project.pendingApprovalCount > 0
          ? "审批仍在处理中，请相关同事关注飞书审批通知。"
          : "如无新增阻塞，可按计划推进下一阶段。",
      targetScope: "project",
      isDeleted: false,
      mentionedUserIds: project.ownerName === "未分配" ? [] : [project.ownerName],
      createdAt: Date.now() - 1000 * 60 * 60 * 3,
      parentCommentId: null,
    },
  ];
}

function buildTimeline(project: BoardProjectRecord): ProjectDetailTimelineEvent[] {
  return [
    {
      id: `${project.id}-timeline-1`,
      actorId: project.ownerName,
      action: "project.created",
      objectType: "project",
      objectId: project.id,
      changeSummary: `${project.name} 已创建并进入 ${getColumnNameByStatus(project.status) ?? project.status}`,
      sourceEntry: "workbench",
      createdAt: Date.now() - 1000 * 60 * 60 * 24,
    },
    {
      id: `${project.id}-timeline-2`,
      actorId: "web_app.board_drag_drop",
      action: "project.stage_reviewed",
      objectType: "project",
      objectId: project.id,
      changeSummary: `当前阶段：${getColumnNameByStatus(project.status) ?? project.status}`,
      sourceEntry: "board",
      createdAt: Date.now() - 1000 * 60 * 60 * 2,
    },
  ];
}

export function createInitialMockProjectDetail(project: BoardProjectRecord): ProjectDetailData {
  const departmentTracks = buildDepartmentTracks(project);

  return {
    project: {
      ...project,
      description: `${project.name} 的项目详情页示例，当前用于验证飞书协同项目台的前端结构。`,
      createdBy: "系统演示账号",
      sourceEntry: "workbench",
      startDate: Date.now() - 1000 * 60 * 60 * 24 * 3,
      endDate: Date.now() + 1000 * 60 * 60 * 24 * 14,
      slaDeadline: Date.now() + 1000 * 60 * 60 * 24 * 7,
    },
    departmentTracks,
    workItems: buildWorkItems(project, departmentTracks),
    approvals: buildApprovals(project, departmentTracks),
    comments: buildComments(project),
    timeline: buildTimeline(project),
    bindings: {
      chats: [
        {
          id: `${project.id}-chat-1`,
          feishuChatId: `oc_${project.id.toLowerCase()}`,
          chatType: "manual_bound",
          pinnedMessageId: `om_${project.id.toLowerCase()}`,
        },
      ],
      docs: [
        {
          id: `${project.id}-doc-1`,
          title: `${project.name} 项目方案`,
          docType: "doc",
          purpose: "方案沉淀",
          feishuDocToken: `doc_${project.id.toLowerCase()}`,
        },
        {
          id: `${project.id}-doc-2`,
          title: `${project.name} 交付清单`,
          docType: "wiki",
          purpose: "交付资料",
          feishuDocToken: `wiki_${project.id.toLowerCase()}`,
        },
      ],
      bases: [
        {
          id: `${project.id}-base-1`,
          baseAppToken: `bascn_${project.id.toLowerCase()}`,
          tableId: "tblProjects",
          recordId: `rec_${project.id.toLowerCase()}`,
          fieldOwnership: "App-owned",
          lastSyncedAt: Date.now() - 1000 * 60 * 30,
        },
      ],
    },
  };
}

export function getMockProjectDetail(
  projectId: string,
  projects: BoardProjectRecord[],
): ProjectDetailData | null {
  const project = projects.find((item) => item.id === projectId);
  if (!project) {
    return null;
  }

  return createInitialMockProjectDetail(project);
}
