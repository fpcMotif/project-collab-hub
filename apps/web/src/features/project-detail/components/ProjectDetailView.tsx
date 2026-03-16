"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { CardMetaRow } from "@/features/board/components/CardMetaRow";
import { PriorityBadge } from "@/features/board/components/PriorityBadge";
import { SlaRiskIndicator } from "@/features/board/components/SlaRiskIndicator";
import { StageAdvanceHint } from "@/features/board/components/StageAdvanceHint";
import {
  DEPT_STATUS_LABELS,
  DEPT_STATUS_STYLES,
} from "@/features/board/constants";
import {
  buildStageAdvanceState,
  getColumnNameByStatus,
} from "@/features/board/lib/view-model";
import { cn } from "@/lib/cn";

import { formatDate, formatDateTime } from "../formatters";
import type {
  ApprovalStatus,
  ProjectDetailApproval,
  ProjectDetailComment,
  ProjectDetailData,
  ProjectDetailDepartmentTrack,
  ProjectDetailTimelineEvent,
  ProjectDetailWorkItem,
  WorkItemStatus,
} from "../types";
import { CommentComposer } from "./CommentComposer";

const WORK_ITEM_STATUS_STYLES: Record<WorkItemStatus, string> = {
  done: "bg-green-100 text-green-700",
  in_progress: "bg-blue-100 text-blue-700",
  in_review: "bg-amber-100 text-amber-700",
  todo: "bg-slate-100 text-slate-700",
};

const WORK_ITEM_STATUS_LABELS: Record<WorkItemStatus, string> = {
  done: "已完成",
  in_progress: "进行中",
  in_review: "评审中",
  todo: "待开始",
};

const APPROVAL_STATUS_STYLES: Record<ApprovalStatus, string> = {
  approved: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-600",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
};

const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  approved: "已通过",
  cancelled: "已取消",
  pending: "待审批",
  rejected: "已拒绝",
};

interface ProjectDetailViewProps {
  detail: ProjectDetailData;
  onCreateComment: (
    body: string,
    mentionedUserIds: string[]
  ) => Promise<{ ok: boolean; message?: string }>;
  onDeleteComment: (
    commentId: string
  ) => Promise<{ ok: boolean; message?: string }>;
  onUpdateWorkItemStatus: (
    workItemId: string,
    status: WorkItemStatus
  ) => Promise<{ ok: boolean; message?: string }>;
  onResolveApproval: (
    approvalId: string,
    status: "approved" | "rejected"
  ) => Promise<{ ok: boolean; message?: string }>;
}

function getProjectMemberOptions(detail: ProjectDetailData) {
  return [
    ...new Set(
      [
        detail.project.ownerName,
        detail.project.createdBy,
        ...detail.departmentTracks.flatMap((track) => [
          track.ownerId,
          ...track.collaboratorIds,
        ]),
        ...detail.workItems.flatMap((item) => [
          item.assigneeId,
          ...item.collaboratorIds,
        ]),
        ...detail.approvals.flatMap((approval) => [
          approval.applicantId,
          approval.resolvedBy,
        ]),
        ...detail.timeline.map((event) => event.actorId),
      ].filter((value): value is string => Boolean(value) && value !== "未分配")
    ),
  ].toSorted((left, right) => left.localeCompare(right, "zh-Hans-CN"));
}

export function ProjectDetailView({
  detail,
  onCreateComment,
  onDeleteComment,
  onUpdateWorkItemStatus,
  onResolveApproval,
}: ProjectDetailViewProps) {
  const stageAdvance = buildStageAdvanceState(detail.project);
  const currentStageName =
    getColumnNameByStatus(detail.project.status) ?? detail.project.status;
  const projectMemberOptions = getProjectMemberOptions(detail);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <Link
              href="/board"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              ← 返回项目看板
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">
              {detail.project.name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {detail.project.customerName} · {detail.project.ownerName}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {currentStageName}
            </span>
            <PriorityBadge priority={detail.project.priority} />
            <SlaRiskIndicator risk={detail.project.slaRisk} />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-6 py-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <section className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="text-sm leading-6 text-gray-600">
                  {detail.project.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                  <span>模板：{detail.project.templateType}</span>
                  <span>来源：{detail.project.sourceEntry}</span>
                  <span>创建人：{detail.project.createdBy}</span>
                  <span>
                    SLA 截止：{formatDate(detail.project.slaDeadline)}
                  </span>
                </div>
              </div>
              <CardMetaRow
                pendingApprovalCount={detail.project.pendingApprovalCount}
                overdueTaskCount={detail.project.overdueTaskCount}
              />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <MetricCard
                label="部门工作流"
                value={String(detail.departmentTracks.length)}
              />
              <MetricCard
                label="行动项"
                value={String(detail.workItems.length)}
              />
              <MetricCard
                label="审批门禁"
                value={String(detail.approvals.length)}
              />
              <MetricCard label="评论" value={String(detail.comments.length)} />
            </div>
            <div className="mt-4">
              <StageAdvanceHint stageAdvance={stageAdvance} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="部门工作流">
              <div className="space-y-3">
                {detail.departmentTracks.map((track) => (
                  <DepartmentTrackRow key={track.id} track={track} />
                ))}
              </div>
            </SectionCard>

            <SectionCard title="行动项">
              <div className="space-y-3">
                {detail.workItems.map((item) => (
                  <WorkItemRow
                    key={item.id}
                    item={item}
                    onUpdateStatus={onUpdateWorkItemStatus}
                  />
                ))}
                {detail.workItems.length === 0 && (
                  <EmptyHint text="暂无行动项" />
                )}
              </div>
            </SectionCard>
          </div>

          <SectionCard title="审批门禁">
            <div className="space-y-3">
              {detail.approvals.map((approval) => (
                <ApprovalRow
                  key={approval.id}
                  approval={approval}
                  onResolve={onResolveApproval}
                />
              ))}
              {detail.approvals.length === 0 && (
                <EmptyHint text="暂无审批门禁" />
              )}
            </div>
          </SectionCard>
        </section>

        <aside className="space-y-4">
          <SectionCard title="飞书绑定">
            <BindingGroup
              title="群聊"
              items={detail.bindings.chats.map(
                (binding) => `${binding.chatType} · ${binding.feishuChatId}`
              )}
            />
            <BindingGroup
              title="文档"
              items={detail.bindings.docs.map(
                (binding) => `${binding.docType} · ${binding.title}`
              )}
            />
            <BindingGroup
              title="Base"
              items={detail.bindings.bases.map(
                (binding) => `${binding.tableId} · ${binding.recordId}`
              )}
            />
          </SectionCard>

          <SectionCard title="评论线程">
            <div className="space-y-3">
              <CommentComposer
                members={projectMemberOptions}
                onSubmit={onCreateComment}
              />
              {detail.comments.map((comment) => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  onDelete={onDeleteComment}
                />
              ))}
              {detail.comments.length === 0 && <EmptyHint text="暂无评论" />}
            </div>
          </SectionCard>

          <SectionCard title="审计时间线">
            <div className="space-y-3">
              {detail.timeline.map((event) => (
                <TimelineRow key={event.id} event={event} />
              ))}
              {detail.timeline.length === 0 && (
                <EmptyHint text="暂无时间线记录" />
              )}
            </div>
          </SectionCard>
        </aside>
      </main>
    </div>
  );
}

export function ProjectDetailLoading() {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl animate-pulse space-y-4">
        <div className="h-10 w-64 rounded bg-gray-200" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="space-y-4">
            <div className="h-52 rounded-xl bg-gray-200" />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="h-80 rounded-xl bg-gray-200" />
              <div className="h-80 rounded-xl bg-gray-200" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-56 rounded-xl bg-gray-200" />
            <div className="h-72 rounded-xl bg-gray-200" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProjectDetailNotFound({ projectId }: { projectId: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-6">
      <div className="max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">未找到项目</h1>
        <p className="mt-2 text-sm text-gray-500">项目 ID：{projectId}</p>
        <Link
          href="/board"
          className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          返回看板
        </Link>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function DepartmentTrackRow({
  track,
}: {
  track: ProjectDetailDepartmentTrack;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {track.departmentName}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Owner：{track.ownerId ?? "未分配"} · 截止：
            {formatDate(track.dueDate)}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-1 text-xs font-medium",
            DEPT_STATUS_STYLES[track.status].bg,
            DEPT_STATUS_STYLES[track.status].text
          )}
        >
          {DEPT_STATUS_LABELS[track.status]}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>{track.isRequired ? "必需部门" : "可选部门"}</span>
        <span>任务数：{track.relatedWorkItemCount}</span>
        <span>待审批：{track.pendingApprovalCount}</span>
      </div>
      {track.blockReason && (
        <p className="mt-2 text-xs text-red-600">
          阻塞原因：{track.blockReason}
        </p>
      )}
    </div>
  );
}

function WorkItemRow({
  item,
  onUpdateStatus,
}: {
  item: ProjectDetailWorkItem;
  onUpdateStatus: (
    workItemId: string,
    status: WorkItemStatus
  ) => Promise<{ ok: boolean; message?: string }>;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{item.title}</p>
          <p className="mt-1 text-xs text-gray-500">
            {item.departmentName ?? "未关联部门"} · 负责人：
            {item.assigneeId ?? "未分配"}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-1 text-xs font-medium",
            WORK_ITEM_STATUS_STYLES[item.status]
          )}
        >
          {WORK_ITEM_STATUS_LABELS[item.status]}
        </span>
      </div>
      <p className="mt-2 text-sm text-gray-600">{item.description}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>截止：{formatDate(item.dueDate)}</span>
        <span>飞书任务：{item.feishuTaskGuid ?? "未同步"}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {item.status === "todo" && (
          <button
            type="button"
            onClick={() => void onUpdateStatus(item.id, "in_progress")}
            className="rounded-md border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
          >
            开始处理
          </button>
        )}
        {item.status !== "done" && (
          <button
            type="button"
            onClick={() => void onUpdateStatus(item.id, "done")}
            className="rounded-md border border-green-200 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
          >
            标记完成
          </button>
        )}
      </div>
    </div>
  );
}

function ApprovalRow({
  approval,
  onResolve,
}: {
  approval: ProjectDetailApproval;
  onResolve: (
    approvalId: string,
    status: "approved" | "rejected"
  ) => Promise<{ ok: boolean; message?: string }>;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {approval.title}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            阶段：
            {getColumnNameByStatus(approval.triggerStage) ??
              approval.triggerStage}
            {approval.departmentName ? ` · ${approval.departmentName}` : ""}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-1 text-xs font-medium",
            APPROVAL_STATUS_STYLES[approval.status]
          )}
        >
          {APPROVAL_STATUS_LABELS[approval.status]}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>申请人：{approval.applicantId}</span>
        <span>实例：{approval.instanceCode ?? "未生成"}</span>
        <span>处理时间：{formatDateTime(approval.resolvedAt)}</span>
      </div>
      {approval.status === "pending" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onResolve(approval.id, "approved")}
            className="rounded-md border border-green-200 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
          >
            通过
          </button>
          <button
            type="button"
            onClick={() => void onResolve(approval.id, "rejected")}
            className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            驳回
          </button>
        </div>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  onDelete,
}: {
  comment: ProjectDetailComment;
  onDelete: (commentId: string) => Promise<{ ok: boolean; message?: string }>;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <span>{comment.authorId}</span>
        <div className="flex items-center gap-3">
          <span>{formatDateTime(comment.createdAt)}</span>
          {!comment.isDeleted && (
            <button
              type="button"
              onClick={() => void onDelete(comment.id)}
              className="text-red-500 hover:text-red-600"
            >
              删除
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-700">
        {comment.isDeleted ? "该评论已被删除" : comment.body}
      </p>
      {comment.mentionedUserIds.length > 0 && !comment.isDeleted && (
        <div className="mt-2 flex flex-wrap gap-2">
          {comment.mentionedUserIds.map((member) => (
            <span
              key={member}
              className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
            >
              @{member}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-gray-400">
        作用域：{comment.targetScope}
      </p>
    </div>
  );
}

function TimelineRow({ event }: { event: ProjectDetailTimelineEvent }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <span>{event.actorId}</span>
        <span>{formatDateTime(event.createdAt)}</span>
      </div>
      <p className="mt-2 text-sm text-gray-700">{event.changeSummary}</p>
      <p className="mt-2 text-xs text-gray-400">{event.action}</p>
    </div>
  );
}

function BindingGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-3 first:mt-0">
      <h3 className="text-sm font-medium text-gray-800">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-gray-400">暂无绑定</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm text-gray-600">
          {items.map((item) => (
            <li key={item} className="rounded-lg bg-gray-50 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p className="rounded-lg bg-gray-50 px-3 py-6 text-center text-sm text-gray-400">
      {text}
    </p>
  );
}
