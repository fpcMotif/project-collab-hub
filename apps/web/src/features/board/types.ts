export const BOARD_STATUSES = [
  "new",
  "assessment",
  "solution",
  "ready",
  "executing",
  "delivering",
  "done",
  "cancelled",
] as const;

export type BoardStatus = (typeof BOARD_STATUSES)[number];

export type Priority = "low" | "medium" | "high" | "urgent";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type BoardFilters = {
  departments: string[];
  owners: string[];
  priorities: Priority[];
  approvalStatuses: ApprovalStatus[];
  overdueOnly: boolean;
  customers: string[];
  templateTypes: string[];
};

export type BoardProject = {
  _id: string;
  name: string;
  customerName?: string;
  ownerId: string;
  departmentId: string;
  status: BoardStatus;
  priority?: Priority;
  templateId?: string;
  summary: {
    departmentStatus: {
      total: number;
      done: number;
      inProgress: number;
      blocked: number;
      waitingApproval: number;
    };
    pendingApprovals: number;
    overdueTasks: number;
    slaRisk: "healthy" | "warning" | "critical";
  };
  detail: {
    departmentWorkflow: Array<{
      _id: string;
      departmentName: string;
      status: string;
      ownerId?: string;
      dueDate?: number;
      isRequired: boolean;
    }>;
    actionItems: Array<{
      _id: string;
      title: string;
      status: string;
      assigneeId?: string;
      dueDate?: number;
      priority: Priority;
    }>;
    commentsCount: number;
    timeline: Array<{
      _id: string;
      action: string;
      changeSummary: string;
      actorId: string;
      _creationTime: number;
    }>;
  };
};

export type BoardResponse = {
  projects: BoardProject[];
  options: {
    departments: string[];
    owners: string[];
    customers: string[];
    templateTypes: string[];
  };
};

export type SavedView = {
  id: string;
  name: string;
  filters: BoardFilters;
};

export const EMPTY_FILTERS: BoardFilters = {
  departments: [],
  owners: [],
  priorities: [],
  approvalStatuses: [],
  overdueOnly: false,
  customers: [],
  templateTypes: [],
};
