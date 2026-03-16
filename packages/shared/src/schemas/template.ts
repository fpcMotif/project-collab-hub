import { Schema } from "effect";

export const ApprovalGateConfig = Schema.Struct({
  approvalCode: Schema.String,
  isRequired: Schema.Boolean,
  title: Schema.String,
  triggerStage: Schema.Literal(
    "new",
    "assessment",
    "solution",
    "ready",
    "executing",
    "delivering"
  ),
});
export type ApprovalGateConfig = typeof ApprovalGateConfig.Type;

export const DepartmentTrackConfig = Schema.Struct({
  defaultOwnerId: Schema.optional(Schema.String),
  departmentId: Schema.String,
  departmentName: Schema.String,
  isRequired: Schema.Boolean,
});
export type DepartmentTrackConfig = typeof DepartmentTrackConfig.Type;

export const NotificationRule = Schema.Struct({
  channel: Schema.Literal("group_chat", "private_chat", "batch_message"),
  enabled: Schema.Boolean,
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
    "sla.at_risk"
  ),
  recipientStrategy: Schema.Literal(
    "project_owner",
    "department_owner",
    "assignee",
    "mentioned_user",
    "all_members"
  ),
});
export type NotificationRule = typeof NotificationRule.Type;

export const ChatPolicy = Schema.Struct({
  addBotAsManager: Schema.Boolean,
  autoCreateChat: Schema.Boolean,
  chatNameTemplate: Schema.optional(Schema.String),
  pinProjectCard: Schema.Boolean,
});
export type ChatPolicy = typeof ChatPolicy.Type;

export class ProjectTemplate extends Schema.Class<ProjectTemplate>(
  "ProjectTemplate"
)({
  approvalGates: Schema.Array(ApprovalGateConfig),
  chatPolicy: ChatPolicy,
  createdBy: Schema.String,
  defaultPriority: Schema.Literal("low", "medium", "high", "urgent"),
  departments: Schema.Array(DepartmentTrackConfig),
  description: Schema.String,
  id: Schema.String,
  isActive: Schema.Boolean,
  name: Schema.String,
  notificationRules: Schema.Array(NotificationRule),
  updatedAt: Schema.DateFromNumber,
  version: Schema.Number,
}) {}

/** Default template for general cross-department projects */
export const DEFAULT_TEMPLATE_CONFIG: Omit<
  typeof ProjectTemplate.Type,
  "id" | "createdBy" | "updatedAt"
> = {
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
  chatPolicy: {
    autoCreateChat: true,
    addBotAsManager: true,
    pinProjectCard: true,
  },
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
  description: "默认项目模板，包含采购、技术、物流三个部门工作流",
  isActive: true,
  name: "通用跨部门协同",
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
  version: 1,
};
