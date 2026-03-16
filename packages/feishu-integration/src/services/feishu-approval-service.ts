import { Context, Effect, Layer } from "effect";

import { FeishuAuthService } from "./feishu-auth-service.js";
import {
  getFeishuData,
  getFeishuObjectData,
  wrapFeishuError,
} from "./feishu-response.js";

export interface CreateApprovalInstanceParams {
  readonly approvalCode: string;
  readonly applicantId: string;
  readonly formData: string;
}

export interface ApprovalInstanceResult {
  readonly instanceCode: string;
}

export class FeishuApprovalService extends Context.Tag("FeishuApprovalService")<
  FeishuApprovalService,
  {
    readonly createInstance: (
      params: CreateApprovalInstanceParams
    ) => Effect.Effect<ApprovalInstanceResult, Error>;
    readonly getInstance: (
      instanceCode: string
    ) => Effect.Effect<Record<string, unknown>, Error>;
  }
>() {}

export const FeishuApprovalServiceLive = Layer.effect(
  FeishuApprovalService,
  FeishuAuthService.pipe(
    Effect.map((auth) => ({
      createInstance: (params: CreateApprovalInstanceParams) =>
        Effect.tryPromise({
          catch: (error) =>
            wrapFeishuError("Failed to create approval instance", error),
          try: async () => {
            const response = await auth.client.approval.instance.create({
              data: {
                approval_code: params.approvalCode,
                form: params.formData,
                open_id: params.applicantId,
              },
            });
            const data = getFeishuData(response);
            const instanceCode = data.instance_code;

            if (!instanceCode) {
              throw new Error("No instance_code in response");
            }

            return { instanceCode };
          },
        }),

      getInstance: (instanceCode: string) =>
        Effect.tryPromise({
          catch: (error) =>
            wrapFeishuError("Failed to get approval instance", error),
          try: async () => {
            const response = await auth.client.approval.instance.get({
              path: { instance_id: instanceCode },
            });

            return getFeishuObjectData(response);
          },
        }),
    }))
  )
);
