interface CardElement {
  readonly tag: string;
  readonly fields?: readonly {
    readonly is_short: boolean;
    readonly text: { readonly content: string; readonly tag: string };
  }[];
  readonly text?: { readonly content: string; readonly tag: string };
  readonly actions?: readonly {
    readonly tag: string;
    readonly text: { readonly content: string; readonly tag: string };
    readonly value: Record<string, unknown>;
    readonly type?: string;
  }[];
}

interface WorkflowApprovalPayload {
  readonly projectName?: string;
  readonly applicantName?: string;
  readonly submissionTime?: string;
  readonly gateId?: string;
  readonly instanceCode?: string;
  readonly approvalTitle?: string;
}

interface StageChangePayload {
  readonly projectName?: string;
  readonly fromStage?: string;
  readonly targetStage?: string;
}

interface ApprovalResultPayload {
  readonly projectName?: string;
  readonly status?: string;
}

interface TaskUpdatePayload {
  readonly projectName?: string;
  readonly taskTitle?: string;
  readonly taskStatus?: string;
}

interface RiskAlertPayload {
  readonly projectName?: string;
  readonly riskType?: string;
}

interface DefaultPayload {
  readonly projectName?: string;
  [key: string]: unknown;
}

const buildWorkflowApprovalCard = (
  payload: WorkflowApprovalPayload,
  _projectName: string
): { header: Record<string, unknown>; elements: CardElement[] } => ({
  elements: [
    {
      fields: [
        {
          is_short: false,
          text: {
            content: `**Project:** ${projectName}`,
            tag: "lark_md",
          },
        },
        {
          is_short: true,
          text: {
            content: `**Applicant:** ${payload.applicantName}`,
            tag: "lark_md",
          },
        },
        {
          is_short: true,
          text: {
            content: `**Submitted:** ${payload.submissionTime}`,
            tag: "lark_md",
          },
        },
      ],
      tag: "div",
    },
    {
      tag: "hr",
    },
    {
      actions: [
        {
          tag: "approval_gate_action",
          text: { content: "Approve", tag: "plain_text" },
          type: "primary",
          value: {
            action: "approve",
            gateId: payload.gateId,
            instanceCode: payload.instanceCode,
          },
        },
        {
          tag: "approval_gate_action",
          text: { content: "Reject", tag: "plain_text" },
          type: "danger",
          value: {
            action: "reject",
            gateId: payload.gateId,
            instanceCode: payload.instanceCode,
          },
        },
      ],
      tag: "action",
    },
  ],
  header: {
    template: "indigo",
    title: {
      content: `Approval Request: ${payload.approvalTitle}`,
      tag: "plain_text",
    },
  },
});

const buildStageChangeCard = (
  payload: StageChangePayload,
  _projectName: string
): { header: Record<string, unknown>; elements: CardElement[] } => ({
  elements: [
    {
      fields: [
        {
          is_short: true,
          text: {
            content: `**Project:** ${projectName}`,
            tag: "lark_md",
          },
        },
        {
          is_short: true,
          text: {
            content: `**Stage:** ${payload.fromStage} → ${payload.targetStage}`,
            tag: "lark_md",
          },
        },
      ],
      tag: "div",
    },
  ],
  header: {
    template: "blue",
    title: { content: "Stage Transition", tag: "plain_text" },
  },
});

const buildApprovalResultCard = (
  payload: ApprovalResultPayload,
  _projectName: string
): { header: Record<string, unknown>; elements: CardElement[] } => ({
  elements: [
    {
      fields: [
        {
          is_short: true,
          text: {
            content: `**Project:** ${projectName}`,
            tag: "lark_md",
          },
        },
        {
          is_short: true,
          text: {
            content: `**Result:** ${payload.status}`,
            tag: "lark_md",
          },
        },
      ],
      tag: "div",
    },
  ],
  header: {
    template: payload.status === "approved" ? "green" : "red",
    title: { content: "Approval Result", tag: "plain_text" },
  },
});

const buildTaskUpdateCard = (
  payload: TaskUpdatePayload,
  _projectName: string
): { header: Record<string, unknown>; elements: CardElement[] } => ({
  elements: [
    {
      fields: [
        {
          is_short: true,
          text: {
            content: `**Task:** ${payload.taskTitle}`,
            tag: "lark_md",
          },
        },
        {
          is_short: true,
          text: {
            content: `**Status:** ${payload.taskStatus}`,
            tag: "lark_md",
          },
        },
      ],
      tag: "div",
    },
  ],
  header: {
    template: "wathet",
    title: { content: "Task Update", tag: "plain_text" },
  },
});

const buildRiskAlertCard = (
  payload: RiskAlertPayload,
  _projectName: string
): { header: Record<string, unknown>; elements: CardElement[] } => ({
  elements: [
    {
      fields: [
        {
          is_short: true,
          text: {
            content: `**Project:** ${projectName}`,
            tag: "lark_md",
          },
        },
        {
          is_short: true,
          text: {
            content: `**Risk:** ${payload.riskType}`,
            tag: "lark_md",
          },
        },
      ],
      tag: "div",
    },
  ],
  header: {
    template: "red",
    title: { content: "Risk Alert", tag: "plain_text" },
  },
});

const buildDefaultCard = (
  payload: DefaultPayload,
  _projectName: string
): { header: Record<string, unknown>; elements: CardElement[] } => ({
  elements: [
    {
      tag: "div",
      text: {
        content: `**Project:** ${projectName}\n${JSON.stringify(payload)}`,
        tag: "lark_md",
      },
    },
  ],
  header: {
    template: "grey",
    title: { content: "Notification", tag: "plain_text" },
  },
});

export const buildNotificationCard = (
  messageType: string,
  payload: Record<string, unknown>
): { header: Record<string, unknown>; elements: CardElement[] } => {
  const projectName = (payload.projectName as string) ?? "Unknown Project";

  switch (messageType) {
    case "workflow_approval": {
      return buildWorkflowApprovalCard(
        payload as WorkflowApprovalPayload,
        projectName
      );
    }
    case "stage_change": {
      return buildStageChangeCard(payload as StageChangePayload, projectName);
    }
    case "approval_result": {
      return buildApprovalResultCard(
        payload as ApprovalResultPayload,
        projectName
      );
    }
    case "task_update": {
      return buildTaskUpdateCard(payload as TaskUpdatePayload, projectName);
    }
    case "risk_alert": {
      return buildRiskAlertCard(payload as RiskAlertPayload, projectName);
    }
    default: {
      return buildDefaultCard(payload as DefaultPayload, projectName);
    }
  }
};
