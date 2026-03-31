import { FeishuBaseService } from "@collab-hub/feishu-integration";
import type {
  CreateRecordParams,
  GetRecordParams,
  UpdateRecordParams,
} from "@collab-hub/feishu-integration";
import { v } from "convex/values";
import { Effect } from "effect";

import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import {
  baseFieldsToProjectPatch,
  projectToBaseFields,
} from "./lib/base-field-map";
import { runFeishu } from "./lib/feishu-layer";

const MAX_RETRY_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 2000;

const retryDelayMs = (attempt: number): number =>
  BASE_RETRY_DELAY_MS * 2 ** Math.min(attempt, MAX_RETRY_ATTEMPTS - 1);

const baseOp = <A>(
  fn: (
    svc: Effect.Effect.Success<typeof FeishuBaseService>
  ) => Effect.Effect<A, unknown>
) => FeishuBaseService.pipe(Effect.flatMap(fn));

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

type ActionCtx = Parameters<Parameters<typeof internalAction>[0]["handler"]>[0];

/** Shared catch handler for sync actions — marks failure and schedules retry. */
const handleSyncFailure = async (
  ctx: ActionCtx,
  bindingId: string,
  currentAttempts: number,
  error: unknown,
  retryAction: typeof internal.baseSyncActions.syncProjectToBase,
  retryArgs: Record<string, string | undefined>
) => {
  const attempts = currentAttempts + 1;

  await ctx.runMutation(internal.baseSyncActions.markSyncFailed, {
    bindingId: bindingId as never,
    error: getErrorMessage(error),
    syncAttempts: attempts,
  });

  if (attempts < MAX_RETRY_ATTEMPTS) {
    await ctx.scheduler.runAfter(
      retryDelayMs(attempts),
      retryAction,
      retryArgs as never
    );
  }
};

// ── Queries for sync data ────────────────────────────────────────────────

export const getBindingWithProject = internalQuery({
  args: { bindingId: v.id("baseBindings") },
  handler: async (ctx, args) => {
    const binding = await ctx.db.get(args.bindingId);
    if (!binding) {
      return null;
    }

    const project = await ctx.db.get(binding.projectId);
    if (!project) {
      return null;
    }

    const workItems = await ctx.db
      .query("workItems")
      .withIndex("by_project", (q) => q.eq("projectId", binding.projectId))
      .collect();

    const departmentTracks = await ctx.db
      .query("departmentTracks")
      .withIndex("by_project", (q) => q.eq("projectId", binding.projectId))
      .collect();

    return { binding, departmentTracks, project, workItems };
  },
});

// ── Push: Sync project data TO Feishu Base ───────────────────────────────

export const syncProjectToBase = internalAction({
  args: { bindingId: v.id("baseBindings") },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.baseSyncActions.setSyncStatus, {
      bindingId: args.bindingId,
      status: "pending",
    });

    const data = await ctx.runQuery(
      internal.baseSyncActions.getBindingWithProject,
      { bindingId: args.bindingId }
    );

    if (!data) {
      return;
    }

    const { binding, departmentTracks, project, workItems } = data;

    try {
      const fields = projectToBaseFields(project, workItems, departmentTracks);

      if (binding.recordId) {
        const params: UpdateRecordParams = {
          appToken: binding.baseAppToken,
          fields,
          recordId: binding.recordId,
          tableId: binding.tableId,
        };
        await runFeishu(baseOp((svc) => svc.updateRecord(params)));
      } else {
        const params: CreateRecordParams = {
          appToken: binding.baseAppToken,
          fields,
          tableId: binding.tableId,
        };
        const result = await runFeishu(
          baseOp((svc) => svc.createRecord(params))
        );

        await ctx.runMutation(internal.baseSyncActions.patchBindingRecordId, {
          bindingId: args.bindingId,
          recordId: result.recordId,
        });
      }

      await ctx.runMutation(internal.baseSyncActions.markSynced, {
        bindingId: args.bindingId,
      });
    } catch (error) {
      await handleSyncFailure(
        ctx,
        args.bindingId,
        binding.syncAttempts ?? 0,
        error,
        internal.baseSyncActions.syncProjectToBase,
        { bindingId: args.bindingId }
      );
    }
  },
});

// ── Pull: Read data FROM Feishu Base into Convex ─────────────────────────

export const pullFromBase = internalAction({
  args: {
    bindingId: v.id("baseBindings"),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.baseSyncActions.setSyncStatus, {
      bindingId: args.bindingId,
      status: "pending",
    });

    const data = await ctx.runQuery(
      internal.baseSyncActions.getBindingWithProject,
      { bindingId: args.bindingId }
    );

    if (!data?.binding.recordId) {
      return;
    }

    const { binding, project } = data;

    try {
      const params: GetRecordParams = {
        appToken: binding.baseAppToken,
        recordId: binding.recordId,
        tableId: binding.tableId,
      };
      const record = await runFeishu(baseOp((svc) => svc.getRecord(params)));

      const fieldOwnership = binding.fieldOwnership
        ? (JSON.parse(binding.fieldOwnership) as Record<string, string>)
        : {};

      const projectPatch = baseFieldsToProjectPatch(
        record.fields,
        fieldOwnership,
        project
      );

      if (Object.keys(projectPatch).length > 0) {
        await ctx.runMutation(internal.baseSyncActions.applyProjectPatch, {
          idempotencyKey: args.idempotencyKey,
          patch: JSON.stringify(projectPatch),
          projectId: binding.projectId,
        });
      }

      await ctx.runMutation(internal.baseSyncActions.markSynced, {
        bindingId: args.bindingId,
      });
    } catch (error) {
      await handleSyncFailure(
        ctx,
        args.bindingId,
        binding.syncAttempts ?? 0,
        error,
        internal.baseSyncActions.pullFromBase,
        { bindingId: args.bindingId, idempotencyKey: args.idempotencyKey }
      );
    }
  },
});

// ── Reconcile: bidirectional conflict resolution ─────────────────────────

export const reconcileSync = internalAction({
  args: { bindingId: v.id("baseBindings") },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.baseSyncActions.setSyncStatus, {
      bindingId: args.bindingId,
      status: "pending",
    });

    const data = await ctx.runQuery(
      internal.baseSyncActions.getBindingWithProject,
      { bindingId: args.bindingId }
    );

    if (!data?.binding.recordId) {
      return;
    }

    const { binding, project } = data;

    try {
      // Step 1: Pull (remote wins for base-owned fields)
      const getParams: GetRecordParams = {
        appToken: binding.baseAppToken,
        recordId: binding.recordId,
        tableId: binding.tableId,
      };
      const record = await runFeishu(baseOp((svc) => svc.getRecord(getParams)));

      const fieldOwnership = binding.fieldOwnership
        ? (JSON.parse(binding.fieldOwnership) as Record<string, string>)
        : {};

      const projectPatch = baseFieldsToProjectPatch(
        record.fields,
        fieldOwnership,
        project
      );

      if (Object.keys(projectPatch).length > 0) {
        await ctx.runMutation(internal.baseSyncActions.applyProjectPatch, {
          patch: JSON.stringify(projectPatch),
          projectId: binding.projectId,
        });
      }

      // Step 2: Push (app wins for app-owned fields)
      const updatedData = await ctx.runQuery(
        internal.baseSyncActions.getBindingWithProject,
        { bindingId: args.bindingId }
      );

      if (!updatedData) {
        return;
      }

      const pushFields = projectToBaseFields(
        updatedData.project,
        updatedData.workItems,
        updatedData.departmentTracks
      );

      const updateParams: UpdateRecordParams = {
        appToken: binding.baseAppToken,
        fields: pushFields,
        recordId: binding.recordId,
        tableId: binding.tableId,
      };
      await runFeishu(baseOp((svc) => svc.updateRecord(updateParams)));

      await ctx.runMutation(internal.baseSyncActions.markSynced, {
        bindingId: args.bindingId,
      });
    } catch (error) {
      await handleSyncFailure(
        ctx,
        args.bindingId,
        binding.syncAttempts ?? 0,
        error,
        internal.baseSyncActions.reconcileSync,
        { bindingId: args.bindingId }
      );
    }
  },
});

// ── Internal Mutations ───────────────────────────────────────────────────

export const patchBindingRecordId = internalMutation({
  args: {
    bindingId: v.id("baseBindings"),
    recordId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.bindingId, {
      lastSyncedAt: Date.now(),
      recordId: args.recordId,
    });
  },
});

export const markSynced = internalMutation({
  args: { bindingId: v.id("baseBindings") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.bindingId, {
      lastSyncError: undefined,
      lastSyncedAt: Date.now(),
      syncAttempts: 0,
      syncStatus: "ok",
    });
  },
});

export const markSyncFailed = internalMutation({
  args: {
    bindingId: v.id("baseBindings"),
    error: v.string(),
    syncAttempts: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.bindingId, {
      lastSyncError: args.error,
      syncAttempts: args.syncAttempts,
      syncStatus: "error",
    });
  },
});

export const setSyncStatus = internalMutation({
  args: {
    bindingId: v.id("baseBindings"),
    status: v.union(v.literal("ok"), v.literal("error"), v.literal("pending")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.bindingId, { syncStatus: args.status });
  },
});

export const applyProjectPatch = internalMutation({
  args: {
    idempotencyKey: v.optional(v.string()),
    patch: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const patchData = JSON.parse(args.patch) as Record<string, unknown>;
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return;
    }

    await ctx.db.patch(args.projectId, patchData);

    await ctx.db.insert("auditEvents", {
      action: "project.synced_from_base",
      actorId: "system",
      changeSummary: `Project fields updated from Feishu Base: ${Object.keys(patchData).join(", ")}`,
      idempotencyKey: args.idempotencyKey,
      objectId: args.projectId,
      objectType: "project",
      projectId: args.projectId,
    });
  },
});
