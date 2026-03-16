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
      approvalCode: "APPROVAL_PROJECT_START",
      isRequired: true,
      title: "项目启动审批",
      triggerStage: "ready",
    },
    {
      approvalCode: "APPROVAL_DELIVERY_GATE",
      isRequired: true,
      title: "交付门禁审批",
      triggerStage: "delivering",
    },
  ],
  chatPolicy: {
    addBotAsManager: true,
    autoCreateChat: true,
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
      channel: "group_chat",
      enabled: true,
      event: "project.created",
      recipientStrategy: "all_members",
    },
    {
      channel: "group_chat",
      enabled: true,
      event: "project.status_changed",
      recipientStrategy: "all_members",
    },
    {
      channel: "private_chat",
      enabled: true,
      event: "approval_gate.approved",
      recipientStrategy: "project_owner",
    },
    {
      channel: "private_chat",
      enabled: true,
      event: "approval_gate.rejected",
      recipientStrategy: "project_owner",
    },
    {
      channel: "private_chat",
      enabled: true,
      event: "comment.mention",
      recipientStrategy: "mentioned_user",
    },
    {
      channel: "private_chat",
      enabled: true,
      event: "work_item.created",
      recipientStrategy: "assignee",
    },
    {
      channel: "private_chat",
      enabled: true,
      event: "task.overdue",
      recipientStrategy: "assignee",
    },
    {
      channel: "group_chat",
      enabled: true,
      event: "sla.at_risk",
      recipientStrategy: "project_owner",
    },
  ],
  version: 1,
};
