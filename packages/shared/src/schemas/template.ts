import { Schema } from "effect";

export const ApprovalGateConfig = Schema.Struct({
  triggerStage: Schema.Literal(
    "new",
    "assessment",
    "solution",
    "ready",
    "executing",
    "delivering",
  ),
  approvalCode: Schema.String,
  title: Schema.String,
  isRequired: Schema.Boolean,
});
export type ApprovalGateConfig = typeof ApprovalGateConfig.Type;

export const DepartmentTrackConfig = Schema.Struct({
  departmentId: Schema.String,
  departmentName: Schema.String,
  isRequired: Schema.Boolean,
  defaultOwnerId: Schema.optional(Schema.String),
});
export type DepartmentTrackConfig = typeof DepartmentTrackConfig.Type;

export const NotificationRule = Schema.Struct({
  event: Schema.Literal(
    "project.created",
    "project.status_changed",
    "approval_gate.created",
    "approval_gate.approved",
    "approval_gate.rejected",
    "work_item.created",
    "work_item.status_changed",
    "comment.mention",
    "task.overdue",
    "sla.at_risk",
  ),
  channel: Schema.Literal("group_chat", "private_chat", "batch_message"),
  enabled: Schema.Boolean,
  recipientStrategy: Schema.Literal(
    "project_owner",
    "department_owner",
    "assignee",
    "mentioned_user",
    "all_members",
  ),
});
export type NotificationRule = typeof NotificationRule.Type;

export const ChatPolicy = Schema.Struct({
  autoCreateChat: Schema.Boolean,
  addBotAsManager: Schema.Boolean,
  pinProjectCard: Schema.Boolean,
  chatNameTemplate: Schema.optional(Schema.String),
});
export type ChatPolicy = typeof ChatPolicy.Type;

export class ProjectTemplate extends Schema.Class<ProjectTemplate>(
  "ProjectTemplate",
)({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  version: Schema.Number,
  isActive: Schema.Boolean,
  departments: Schema.Array(DepartmentTrackConfig),
  approvalGates: Schema.Array(ApprovalGateConfig),
  notificationRules: Schema.Array(NotificationRule),
  chatPolicy: ChatPolicy,
  defaultPriority: Schema.Literal("low", "medium", "high", "urgent"),
  createdBy: Schema.String,
  updatedAt: Schema.DateFromNumber,
}) {}

/** Default template for general cross-department projects */
export const DEFAULT_TEMPLATE_CONFIG: Omit<
  typeof ProjectTemplate.Type,
  "id" | "createdBy" | "updatedAt"
> = {
  name: "通用跨部门协同",
  description: "默认项目模板，包含采购、技术、物流三个部门工作流",
  version: 1,
  isActive: true,
  defaultPriority: "medium",
  departments: [
    {
      departmentId: "dept-procurement",
      departmentName: "采购部",
      isRequired: true,
    },
    {
      departmentId: "dept-tech",
      departmentName: "技术部",
      isRequired: true,
    },
    {
      departmentId: "dept-logistics",
      departmentName: "物流部",
      isRequired: true,
    },
    {
      departmentId: "dept-legal",
      departmentName: "法务部",
      isRequired: false,
    },
  ],
  approvalGates: [
    {
      triggerStage: "ready",
      approvalCode: "APPROVAL_PROJECT_START",
      title: "项目启动审批",
      isRequired: true,
    },
    {
      triggerStage: "delivering",
      approvalCode: "APPROVAL_DELIVERY_GATE",
      title: "交付门禁审批",
      isRequired: true,
    },
  ],
  notificationRules: [
    {
      event: "project.created",
      channel: "group_chat",
      enabled: true,
      recipientStrategy: "all_members",
    },
    {
      event: "project.status_changed",
      channel: "group_chat",
      enabled: true,
      recipientStrategy: "all_members",
    },
    {
      event: "approval_gate.approved",
      channel: "private_chat",
      enabled: true,
      recipientStrategy: "project_owner",
    },
    {
      event: "approval_gate.rejected",
      channel: "private_chat",
      enabled: true,
      recipientStrategy: "project_owner",
    },
    {
      event: "comment.mention",
      channel: "private_chat",
      enabled: true,
      recipientStrategy: "mentioned_user",
    },
    {
      event: "work_item.created",
      channel: "private_chat",
      enabled: true,
      recipientStrategy: "assignee",
    },
    {
      event: "task.overdue",
      channel: "private_chat",
      enabled: true,
      recipientStrategy: "assignee",
    },
    {
      event: "sla.at_risk",
      channel: "group_chat",
      enabled: true,
      recipientStrategy: "project_owner",
    },
  ],
  chatPolicy: {
    autoCreateChat: true,
    addBotAsManager: true,
    pinProjectCard: true,
  },
};
