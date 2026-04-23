import type { ProjectDetailApproval } from "../types";

interface ApprovalGateProps {
  approval: ProjectDetailApproval;
  onResolve: (
    approvalId: string,
    status: "approved" | "rejected"
  ) => Promise<{ ok: boolean; message?: string }>;
  onRequestResubmit: (
    title: string,
    approvalCode: string,
    triggerStage:
      | "new"
      | "assessment"
      | "solution"
      | "ready"
      | "executing"
      | "delivering"
      | "done"
      | "cancelled"
  ) => Promise<{ ok: boolean; message?: string }>;
}

export const ApprovalGate = ({
  approval,
  onResolve: _onResolve,
  onRequestResubmit: _onRequestResubmit,
}: ApprovalGateProps) => (
  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-sm">
    <div className="flex items-center gap-3">
      <span className="font-medium">{approval.title}</span>
    </div>
  </div>
);
