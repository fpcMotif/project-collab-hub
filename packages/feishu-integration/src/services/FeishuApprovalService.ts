import { Context, Effect, Layer } from "effect";

import { FeishuAuthService } from "./FeishuAuthService.js";

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
  Effect.map(FeishuAuthService, (auth) => ({
    createInstance: (params: CreateApprovalInstanceParams) =>
      Effect.tryPromise({
        catch: (error) =>
          new Error(
            `Failed to create approval instance: ${error instanceof Error ? error.message : String(error)}`
          ),
        try: async () => {
          const resp = await auth.client.approval.instance.create({
            data: {
              approval_code: params.approvalCode,
              form: params.formData,
              open_id: params.applicantId,
            },
          });
          const instanceCode = (
            resp?.data as { instance_code?: string } | undefined
          )?.instance_code;
          if (!instanceCode) {
            throw new Error("No instance_code in response");
          }
          return { instanceCode };
        },
      }),

    getInstance: (instanceCode: string) =>
      Effect.tryPromise({
        catch: (error) =>
          new Error(
            `Failed to get approval instance: ${error instanceof Error ? error.message : String(error)}`
          ),
        try: async () => {
          const resp = await auth.client.approval.instance.get({
            path: { instance_id: instanceCode },
          });
          return (resp?.data as Record<string, unknown>) ?? {};
        },
      }),
  }))
);
