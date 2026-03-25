import { Context, Effect, Layer } from "effect";

import { FeishuError } from "../errors/feishu-error.js";
import { FeishuAuthService } from "./feishu-auth-service.js";
import { assertFeishuSuccess, wrapFeishuError } from "./feishu-response.js";

// ── Parameter Types ──────────────────────────────────────────────────────

export interface TriggerWorkflowParams {
  readonly approvalCode: string;
  readonly openId: string;
  readonly formData: string;
  readonly departmentId?: string;
}

export interface GetWorkflowInstanceParams {
  readonly instanceId: string;
}

export interface RespondToWorkflowNodeParams {
  readonly instanceId: string;
  readonly nodeId: string;
  readonly userId: string;
  readonly action: "approve" | "reject";
  readonly comment?: string;
}

// ── Result Types ─────────────────────────────────────────────────────────

export interface WorkflowInstanceResult {
  readonly instanceCode: string;
}

export interface WorkflowInstanceDetail {
  readonly instanceCode: string;
  readonly status: string;
  readonly approvalCode: string;
  readonly timeline: readonly Record<string, unknown>[];
}

// ── Service Definition ───────────────────────────────────────────────────

export class FeishuWorkflowService extends Context.Tag("FeishuWorkflowService")<
  FeishuWorkflowService,
  {
    readonly triggerWorkflow: (
      params: TriggerWorkflowParams
    ) => Effect.Effect<WorkflowInstanceResult, FeishuError>;
    readonly getWorkflowInstance: (
      params: GetWorkflowInstanceParams
    ) => Effect.Effect<WorkflowInstanceDetail, FeishuError>;
    readonly respondToNode: (
      params: RespondToWorkflowNodeParams
    ) => Effect.Effect<void, FeishuError>;
  }
>() {}

// ── Live Implementation ──────────────────────────────────────────────────
// Feishu Workflow API uses the same approval endpoints under the hood.
// Workflow = approval definition with custom forms + multi-level nodes.

export const FeishuWorkflowServiceLive = Layer.effect(
  FeishuWorkflowService,
  FeishuAuthService.pipe(
    Effect.map((auth) => ({
      getWorkflowInstance: (params: GetWorkflowInstanceParams) =>
        Effect.tryPromise({
          catch: (error) =>
            wrapFeishuError("Failed to get workflow instance", error),
          try: async () => {
            const response = await auth.client.approval.instance.get({
              path: { instance_id: params.instanceId },
            });

            assertFeishuSuccess(response);

            const data = response?.data as Record<string, unknown> | undefined;
            if (!data) {
              throw new FeishuError({ message: "No data in response" });
            }

            return {
              approvalCode: (data.approval_code as string) ?? "",
              instanceCode: (data.instance_code as string) ?? params.instanceId,
              status: (data.status as string) ?? "UNKNOWN",
              timeline: (data.timeline as Record<string, unknown>[]) ?? [],
            };
          },
        }),

      respondToNode: (params: RespondToWorkflowNodeParams) =>
        Effect.tryPromise({
          catch: (error) =>
            wrapFeishuError("Failed to respond to workflow node", error),
          try: async () => {
            const instanceResponse = await auth.client.approval.instance.get({
              path: { instance_id: params.instanceId },
            });

            assertFeishuSuccess(instanceResponse);

            const instData = instanceResponse.data as
              | { approval_code?: string }
              | undefined;
            const approvalCode = instData?.approval_code;

            if (!approvalCode) {
              throw new FeishuError({
                message: "No approval_code on approval instance",
              });
            }

            const taskPayload = {
              data: {
                approval_code: approvalCode,
                comment: params.comment ?? "",
                instance_code: params.instanceId,
                task_id: params.nodeId,
                user_id: params.userId,
              },
            };

            const taskResponse =
              params.action === "approve"
                ? await auth.client.approval.task.approve(taskPayload)
                : await auth.client.approval.task.reject(taskPayload);

            assertFeishuSuccess(taskResponse);
          },
        }),

      triggerWorkflow: (params: TriggerWorkflowParams) =>
        Effect.tryPromise({
          catch: (error) =>
            wrapFeishuError("Failed to trigger workflow", error),
          try: async () => {
            const response = await auth.client.approval.instance.create({
              data: {
                approval_code: params.approvalCode,
                department_id: params.departmentId,
                form: params.formData,
                open_id: params.openId,
              },
            });

            const data = response?.data as
              | { instance_code?: string }
              | undefined;
            const instanceCode = data?.instance_code;

            if (!instanceCode) {
              throw new FeishuError({
                message: "No instance_code in workflow response",
              });
            }

            return { instanceCode };
          },
        }),
    }))
  )
);
