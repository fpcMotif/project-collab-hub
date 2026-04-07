import { Context, Effect, Layer } from "effect";

import { FeishuError } from "../errors/feishu-error.js";
import { FeishuAuthService } from "./feishu-auth-service.js";
import {
  assertFeishuSuccess,
  getFeishuData,
  getFeishuObjectData,
  wrapFeishuError,
} from "./feishu-response.js";

export interface CreateFeishuTaskParams {
  readonly summary: string;
  readonly description: string;
  readonly dueTimestamp: string;
  readonly memberIds: readonly string[];
  readonly originHref: string;
  readonly originTitle: string;
}

export interface UpdateFeishuTaskParams {
  readonly taskGuid: string;
  readonly summary?: string;
  readonly description?: string;
}

export interface FeishuTaskResult {
  readonly taskGuid: string;
}

export class FeishuTaskService extends Context.Tag("FeishuTaskService")<
  FeishuTaskService,
  {
    readonly createTask: (
      params: CreateFeishuTaskParams
    ) => Effect.Effect<FeishuTaskResult, FeishuError>;
    readonly updateTask: (
      params: UpdateFeishuTaskParams
    ) => Effect.Effect<void, FeishuError>;
    readonly completeTask: (
      taskGuid: string
    ) => Effect.Effect<void, FeishuError>;
    readonly uncompleteTask: (
      taskGuid: string
    ) => Effect.Effect<void, FeishuError>;
    readonly getTask: (
      taskGuid: string
    ) => Effect.Effect<Record<string, unknown>, FeishuError>;
  }
>() {}

export const FeishuTaskServiceLive = Layer.effect(
  FeishuTaskService,
  FeishuAuthService.pipe(
    Effect.map((auth) => ({
      completeTask: (taskGuid: string) =>
        Effect.tryPromise({
          catch: (error) =>
            wrapFeishuError("Failed to complete Feishu task", error),
          try: async () => {
            const response = await auth.client.task.v2.task.patch({
              data: {
                task: { completed_at: String(Math.floor(Date.now() / 1000)) },
                update_fields: ["completed_at"],
              },
              path: { task_guid: taskGuid },
            });

            assertFeishuSuccess(response);
          },
        }),

      createTask: (params: CreateFeishuTaskParams) =>
        Effect.tryPromise({
          catch: (error) =>
            wrapFeishuError("Failed to create Feishu task", error),
          try: async () => {
            const response = await auth.client.task.v2.task.create({
              data: {
                description: params.description,
                due: {
                  is_all_day: true,
                  timestamp: params.dueTimestamp,
                },
                members: params.memberIds.map((id) => ({
                  id,
                  role: "assignee",
                  type: "user" as const,
                })),
                origin: {
                  href: { title: params.originTitle, url: params.originHref },
                  platform_i18n_name: { en_us: "Project Collab Hub" },
                },
                summary: params.summary,
              },
            });
            const data = getFeishuData(response);
            const taskGuid = data.task?.guid;

            if (!taskGuid) {
              throw new FeishuError({
                message: "No task guid in response",
              });
            }

            return { taskGuid };
          },
        }),

      getTask: (taskGuid: string) =>
        Effect.tryPromise({
          catch: (error) => wrapFeishuError("Failed to get Feishu task", error),
          try: async () => {
            const response = await auth.client.task.v2.task.get({
              path: { task_guid: taskGuid },
            });

            return getFeishuObjectData(response);
          },
        }),

      uncompleteTask: (taskGuid: string) =>
        Effect.tryPromise({
          catch: (error) =>
            wrapFeishuError("Failed to uncomplete Feishu task", error),
          try: async () => {
            const response = await auth.client.task.v2.task.patch({
              data: {
                task: { completed_at: "0" },
                update_fields: ["completed_at"],
              },
              path: { task_guid: taskGuid },
            });

            assertFeishuSuccess(response);
          },
        }),

      updateTask: (params: UpdateFeishuTaskParams) =>
        Effect.tryPromise({
          catch: (error) =>
            wrapFeishuError("Failed to update Feishu task", error),
          try: async () => {
            const task: Record<string, string> = {};
            const update_fields: string[] = [];

            if (params.summary !== undefined) {
              task.summary = params.summary;
              update_fields.push("summary");
            }
            if (params.description !== undefined) {
              task.description = params.description;
              update_fields.push("description");
            }

            if (update_fields.length === 0) {
              return;
            }

            const response = await auth.client.task.v2.task.patch({
              data: {
                task,
                update_fields,
              },
              path: { task_guid: params.taskGuid },
            });

            assertFeishuSuccess(response);
          },
        }),
    }))
  )
);
