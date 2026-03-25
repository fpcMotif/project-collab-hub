export const FEISHU_TASK_STATUS_MAP: Record<
  string,
  "done" | "in_progress" | "in_review" | "todo"
> = {
  closed: "done",
  completed: "done",
  created: "todo",
  done: "done",
  in_progress: "in_progress",
  in_review: "in_review",
  not_started: "todo",
  reviewing: "in_review",
  running: "in_progress",
  todo: "todo",
};

export const mapFeishuApprovalStatus = (
  approvalStatus: string | undefined
): "approved" | "rejected" | "cancelled" | null => {
  const statusMap: Record<string, "approved" | "rejected" | "cancelled"> = {
    APPROVED: "approved",
    CANCELED: "cancelled",
    REJECTED: "rejected",
  };
  if (!approvalStatus) {
    return null;
  }
  return statusMap[approvalStatus] ?? null;
};

export const mapFeishuWorkflowStatus = (
  status: string | undefined
): "approved" | "cancelled" | "rejected" | "running" => {
  const workflowStatusMap: Record<
    string,
    "approved" | "cancelled" | "rejected" | "running"
  > = {
    APPROVED: "approved",
    CANCELED: "cancelled",
    PENDING: "running",
    REJECTED: "rejected",
    REVERTED: "cancelled",
  };

  if (!status) {
    return "running";
  }

  return workflowStatusMap[status] ?? "running";
};

export const mapFeishuTaskToWorkItemStatus = (
  taskStatus: string
): "done" | "in_progress" | "in_review" | "todo" | null => {
  const mapped = FEISHU_TASK_STATUS_MAP[taskStatus.toLowerCase()];
  return mapped ?? null;
};
