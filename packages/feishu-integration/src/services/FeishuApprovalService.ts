import { Context, Effect, Layer } from "effect";
import { FeishuAuthService } from "./FeishuAuthService.js";
import { FeishuError } from "../errors/FeishuError.js";

export interface CreateApprovalInstanceParams {
  readonly approvalCode: string;
  readonly applicantId: string;
  readonly formData: string;
}

export interface ApprovalInstanceResult {
  readonly instanceCode: string;
}

export class FeishuApprovalService extends Context.Tag(
  "FeishuApprovalService",
)<
  FeishuApprovalService,
  {
    readonly createInstance: (
      params: CreateApprovalInstanceParams,
    ) => Effect.Effect<ApprovalInstanceResult, FeishuError>;
    readonly getInstance: (
      instanceCode: string,
    ) => Effect.Effect<Record<string, unknown>, FeishuError>;
  }
>() {}

export const FeishuApprovalServiceLive = Layer.effect(
  FeishuApprovalService,
  Effect.map(FeishuAuthService, (auth) => ({
    createInstance: (params: CreateApprovalInstanceParams) =>
      Effect.tryPromise({
        try: async () => {
          const resp = await auth.client.approval.instance.create({
            data: {
              approval_code: params.approvalCode,
              open_id: params.applicantId,
              form: params.formData,
            },
          });
          const instanceCode = (
            resp?.data as { instance_code?: string } | undefined
          )?.instance_code;
          if (!instanceCode) {
            throw new FeishuError({ message: "No instance_code in response" });
          }
          return { instanceCode };
        },
        catch: (error) =>
          new FeishuError({ message: `Failed to create approval instance: ${error instanceof Error ? error.message : String(error)}` }),
      }),

    getInstance: (instanceCode: string) =>
      Effect.tryPromise({
        try: async () => {
          const resp = await auth.client.approval.instance.get({
            path: { instance_id: instanceCode },
          });
          return (resp?.data as Record<string, unknown>) ?? {};
        },
        catch: (error) =>
          new FeishuError({ message: `Failed to get approval instance: ${error instanceof Error ? error.message : String(error)}` }),
      }),
  })),
);
