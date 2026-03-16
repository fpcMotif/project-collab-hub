export type ProjectStatus =
  | "new"
  | "assessment"
  | "solution"
  | "ready"
  | "executing"
  | "delivering"
  | "done"
  | "cancelled";

export type ProjectCardData = {
  _id: string;
  name: string;
  description: string;
  ownerId: string;
  departmentId: string;
  status: ProjectStatus;
  priority?: "low" | "medium" | "high" | "urgent";
};

export const BOARD_COLUMNS: Array<{ status: ProjectStatus; title: string }> = [
  { status: "new", title: "新建" },
  { status: "assessment", title: "需求评估" },
  { status: "solution", title: "方案设计" },
  { status: "ready", title: "就绪" },
  { status: "executing", title: "执行中" },
  { status: "delivering", title: "交付中" },
  { status: "done", title: "已完成" },
  { status: "cancelled", title: "已取消" },
];
