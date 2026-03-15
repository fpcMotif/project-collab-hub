import { Context, Effect, Layer } from "effect";
import { FeishuAuthService } from "./FeishuAuthService.js";
import { FeishuError } from "../errors/FeishuError.js";

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
      params: CreateFeishuTaskParams,
    ) => Effect.Effect<FeishuTaskResult, FeishuError>;
    readonly completeTask: (
      taskGuid: string,
    ) => Effect.Effect<void, FeishuError>;
    readonly getTask: (
      taskGuid: string,
    ) => Effect.Effect<Record<string, unknown>, FeishuError>;
  }
>() {}

export const FeishuTaskServiceLive = Layer.effect(
  FeishuTaskService,
  Effect.map(FeishuAuthService, (auth) => ({
    createTask: (params: CreateFeishuTaskParams) =>
      Effect.tryPromise({
        try: async () => {
          const resp = await auth.client.task.v2.task.create({
            data: {
              summary: params.summary,
              description: params.description,
              due: {
                timestamp: params.dueTimestamp,
                is_all_day: true,
              },
              origin: {
                platform_i18n_name: { en_us: "Project Collab Hub" },
                href: { url: params.originHref, title: params.originTitle },
              },
              members: params.memberIds.map((id) => ({
                id,
                type: "user" as const,
                role: "assignee",
              })),
            },
          });
          const taskGuid = (resp?.data as { task?: { guid?: string } })?.task
            ?.guid;
          if (!taskGuid) {
            throw new FeishuError({ message: "No task guid in response" });
          }
          return { taskGuid };
        },
        catch: (error) =>
          new FeishuError({ message: `Failed to create Feishu task: ${error instanceof Error ? error.message : String(error)}` }),
      }),

    completeTask: (taskGuid: string) =>
      Effect.tryPromise({
        try: () =>
          auth.client.task.v2.task.patch({
            path: { task_guid: taskGuid },
            data: {
              task: { completed_at: String(Math.floor(Date.now() / 1000)) },
              update_fields: ["completed_at"],
            },
          }),
        catch: (error) =>
          new FeishuError({ message: `Failed to complete Feishu task: ${error instanceof Error ? error.message : String(error)}` }),
      }).pipe(Effect.asVoid),

    getTask: (taskGuid: string) =>
      Effect.tryPromise({
        try: async () => {
          const resp = await auth.client.task.v2.task.get({
            path: { task_guid: taskGuid },
          });
          return (resp?.data as Record<string, unknown>) ?? {};
        },
        catch: (error) =>
          new FeishuError({ message: `Failed to get Feishu task: ${error instanceof Error ? error.message : String(error)}` }),
      }),
  })),
);
