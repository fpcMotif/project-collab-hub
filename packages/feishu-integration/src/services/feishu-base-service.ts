import { Context, Effect, Layer } from "effect";

import { FeishuError } from "../errors/feishu-error.js";
import { FeishuAuthService } from "./feishu-auth-service.js";
import {
  assertFeishuSuccess,
  getFeishuData,
  wrapFeishuError,
} from "./feishu-response.js";

// ── Parameter Types ──────────────────────────────────────────────────────

export interface CreateRecordParams {
  readonly appToken: string;
  readonly tableId: string;
  readonly fields: Record<string, unknown>;
}

export interface BatchCreateRecordsParams {
  readonly appToken: string;
  readonly tableId: string;
  readonly records: readonly { readonly fields: Record<string, unknown> }[];
}

export interface UpdateRecordParams {
  readonly appToken: string;
  readonly tableId: string;
  readonly recordId: string;
  readonly fields: Record<string, unknown>;
}

export interface GetRecordParams {
  readonly appToken: string;
  readonly tableId: string;
  readonly recordId: string;
}

export interface ListRecordsParams {
  readonly appToken: string;
  readonly tableId: string;
  readonly pageSize?: number;
  readonly pageToken?: string;
  readonly filter?: string;
  readonly sort?: readonly string[];
}

export interface DeleteRecordParams {
  readonly appToken: string;
  readonly tableId: string;
  readonly recordId: string;
}

// ── Result Types ─────────────────────────────────────────────────────────

export interface RecordResult {
  readonly recordId: string;
  readonly fields: Record<string, unknown>;
}

export interface RecordListResult {
  readonly records: readonly RecordResult[];
  readonly hasMore: boolean;
  readonly pageToken?: string;
  readonly total: number;
}

// ── Service Definition ───────────────────────────────────────────────────

export class FeishuBaseService extends Context.Tag("FeishuBaseService")<
  FeishuBaseService,
  {
    readonly createRecord: (
      params: CreateRecordParams
    ) => Effect.Effect<RecordResult, FeishuError>;
    readonly batchCreateRecords: (
      params: BatchCreateRecordsParams
    ) => Effect.Effect<readonly RecordResult[], FeishuError>;
    readonly updateRecord: (
      params: UpdateRecordParams
    ) => Effect.Effect<RecordResult, FeishuError>;
    readonly getRecord: (
      params: GetRecordParams
    ) => Effect.Effect<RecordResult, FeishuError>;
    readonly listRecords: (
      params: ListRecordsParams
    ) => Effect.Effect<RecordListResult, FeishuError>;
    readonly deleteRecord: (
      params: DeleteRecordParams
    ) => Effect.Effect<void, FeishuError>;
  }
>() {}

// ── Helpers ──────────────────────────────────────────────────────────────

const parseRecordResult = (data: unknown): RecordResult => {
  const record = data as {
    record_id?: string;
    fields?: Record<string, unknown>;
  };

  if (!record.record_id) {
    throw new FeishuError({ message: "No record_id in response" });
  }

  return {
    fields: record.fields ?? {},
    recordId: record.record_id,
  };
};

// The SDK uses a strict union for field values; we accept `unknown` at our API
// boundary and cast internally since callers may pass any serializable value.
type SdkFieldValue =
  | boolean
  | number
  | string
  | string[]
  | Record<string, unknown>;
type SdkFields = Record<string, SdkFieldValue>;

const toSdkFields = (fields: Record<string, unknown>): SdkFields =>
  fields as SdkFields;

// ── Live Implementation ──────────────────────────────────────────────────

export const FeishuBaseServiceLive = Layer.effect(
  FeishuBaseService,
  FeishuAuthService.pipe(
    Effect.map((auth) => ({
      batchCreateRecords: (params: BatchCreateRecordsParams) =>
        Effect.tryPromise({
          catch: (error) =>
            wrapFeishuError("Failed to batch create Base records", error),
          try: async () => {
            const response =
              await auth.client.bitable.v1.appTableRecord.batchCreate({
                data: {
                  records: params.records.map((r) => ({
                    fields: toSdkFields(r.fields),
                  })),
                },
                path: {
                  app_token: params.appToken,
                  table_id: params.tableId,
                },
              });

            const data = getFeishuData(response);
            const records = (data as { records?: unknown[] }).records ?? [];

            return records.map(parseRecordResult);
          },
        }),

      createRecord: (params: CreateRecordParams) =>
        Effect.tryPromise({
          catch: (error) =>
            wrapFeishuError("Failed to create Base record", error),
          try: async () => {
            const response = await auth.client.bitable.v1.appTableRecord.create(
              {
                data: { fields: toSdkFields(params.fields) },
                path: {
                  app_token: params.appToken,
                  table_id: params.tableId,
                },
              }
            );

            const data = getFeishuData(response);

            return parseRecordResult(
              (data as { record?: unknown }).record ?? data
            );
          },
        }),

      deleteRecord: (params: DeleteRecordParams) =>
        Effect.tryPromise({
          catch: (error) =>
            wrapFeishuError("Failed to delete Base record", error),
          try: async () => {
            const response = await auth.client.bitable.v1.appTableRecord.delete(
              {
                path: {
                  app_token: params.appToken,
                  record_id: params.recordId,
                  table_id: params.tableId,
                },
              }
            );

            assertFeishuSuccess(response);
          },
        }),

      getRecord: (params: GetRecordParams) =>
        Effect.tryPromise({
          catch: (error) => wrapFeishuError("Failed to get Base record", error),
          try: async () => {
            const response = await auth.client.bitable.v1.appTableRecord.get({
              path: {
                app_token: params.appToken,
                record_id: params.recordId,
                table_id: params.tableId,
              },
            });

            const data = getFeishuData(response);

            return parseRecordResult(
              (data as { record?: unknown }).record ?? data
            );
          },
        }),

      listRecords: (params: ListRecordsParams) =>
        Effect.tryPromise({
          catch: (error) =>
            wrapFeishuError("Failed to list Base records", error),
          try: async () => {
            const response = await auth.client.bitable.v1.appTableRecord.list({
              params: {
                filter: params.filter,
                page_size: params.pageSize ?? 100,
                page_token: params.pageToken,
                sort: params.sort ? JSON.stringify(params.sort) : undefined,
              },
              path: {
                app_token: params.appToken,
                table_id: params.tableId,
              },
            });

            const data = getFeishuData(response) as {
              has_more?: boolean;
              items?: unknown[];
              page_token?: string;
              total?: number;
            };

            return {
              hasMore: data.has_more ?? false,
              pageToken: data.page_token,
              records: (data.items ?? []).map(parseRecordResult),
              total: data.total ?? 0,
            };
          },
        }),

      updateRecord: (params: UpdateRecordParams) =>
        Effect.tryPromise({
          catch: (error) =>
            wrapFeishuError("Failed to update Base record", error),
          try: async () => {
            const response = await auth.client.bitable.v1.appTableRecord.update(
              {
                data: { fields: toSdkFields(params.fields) },
                path: {
                  app_token: params.appToken,
                  record_id: params.recordId,
                  table_id: params.tableId,
                },
              }
            );

            const data = getFeishuData(response);

            return parseRecordResult(
              (data as { record?: unknown }).record ?? data
            );
          },
        }),
    }))
  )
);
