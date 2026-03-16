import { Context, Effect, Layer } from "effect";

import { FeishuAuthService } from "./feishu-auth-service.js";

export interface CreateFeishuTaskParams {
  readonly summary: string;
  readonly description: string;
  readonly dueTimestamp: string;
  readonly memberIds: readonly string[];
  readonly originHref: string;
  readonly originTitle: string;
}

export interface FeishuTaskResult {
  readonly taskGuid: string;
}

export class FeishuTaskService extends Context.Tag("FeishuTaskService")<
  FeishuTaskService,
  {
    readonly createTask: (
      params: CreateFeishuTaskParams
    ) => Effect.Effect<FeishuTaskResult, Error>;
    readonly completeTask: (taskGuid: string) => Effect.Effect<void, Error>;
    readonly getTask: (
      taskGuid: string
    ) => Effect.Effect<Record<string, unknown>, Error>;
  }
>() {}

export const FeishuTaskServiceLive = Layer.effect(
  FeishuTaskService,
  FeishuAuthService.pipe(
    Effect.map((auth) => ({
      completeTask: (taskGuid: string) =>
        Effect.tryPromise({
          catch: (error) =>
            new Error(
              `Failed to complete Feishu task: ${error instanceof Error ? error.message : String(error)}`
            ),
          try: () =>
            auth.client.task.v2.task.patch({
              data: {
                task: { completed_at: String(Math.floor(Date.now() / 1000)) },
                update_fields: ["completed_at"],
              },
              path: { task_guid: taskGuid },
            }),
        }).pipe(Effect.asVoid),

      createTask: (params: CreateFeishuTaskParams) =>
        Effect.tryPromise({
          catch: (error) =>
            new Error(
              `Failed to create Feishu task: ${error instanceof Error ? error.message : String(error)}`
            ),
          try: async () => {
            const resp = await auth.client.task.v2.task.create({
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
            const taskGuid = (resp?.data as { task?: { guid?: string } })?.task
              ?.guid;
            if (!taskGuid) {
              throw new Error("No task guid in response");
            }
            return { taskGuid };
          },
        }),

      getTask: (taskGuid: string) =>
        Effect.tryPromise({
          catch: (error) =>
            new Error(
              `Failed to get Feishu task: ${error instanceof Error ? error.message : String(error)}`
            ),
          try: async () => {
            const resp = await auth.client.task.v2.task.get({
              path: { task_guid: taskGuid },
            });
            return (resp?.data as Record<string, unknown>) ?? {};
          },
        }),
    }))
  )
);
