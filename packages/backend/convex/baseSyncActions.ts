import { FeishuBaseService, FeishuLive } from "@collab-hub/feishu-integration";
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

const buildFeishuLayer = () => {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error(
      "Missing FEISHU_APP_ID or FEISHU_APP_SECRET environment variables"
    );
  }

  return FeishuLive({ appId, appSecret });
};

const runBaseEffect = <A>(
  effect: Effect.Effect<A, unknown, FeishuBaseService>
): Promise<A> => Effect.runPromise(Effect.provide(effect, buildFeishuLayer()));

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
    const data = await ctx.runQuery(
      internal.baseSyncActions.getBindingWithProject,
      { bindingId: args.bindingId }
    );

    if (!data) {
      return;
    }

    const { binding, departmentTracks, project, workItems } = data;

    const fields = projectToBaseFields(project, workItems, departmentTracks);

    if (binding.recordId) {
      const params: UpdateRecordParams = {
        appToken: binding.baseAppToken,
        fields,
        recordId: binding.recordId,
        tableId: binding.tableId,
      };

      await runBaseEffect(
        FeishuBaseService.pipe(
          Effect.flatMap((svc) => svc.updateRecord(params))
        )
      );
    } else {
      const params: CreateRecordParams = {
        appToken: binding.baseAppToken,
        fields,
        tableId: binding.tableId,
      };

      const result = await runBaseEffect(
        FeishuBaseService.pipe(
          Effect.flatMap((svc) => svc.createRecord(params))
        )
      );

      await ctx.runMutation(internal.baseSyncActions.patchBindingRecordId, {
        bindingId: args.bindingId,
        recordId: result.recordId,
      });
    }

    await ctx.runMutation(internal.baseSyncActions.markSynced, {
      bindingId: args.bindingId,
    });
  },
});

// ── Pull: Read data FROM Feishu Base into Convex ─────────────────────────

export const pullFromBase = internalAction({
  args: { bindingId: v.id("baseBindings") },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(
      internal.baseSyncActions.getBindingWithProject,
      { bindingId: args.bindingId }
    );

    if (!data?.binding.recordId) {
      return;
    }

    const { binding, project } = data;

    const params: GetRecordParams = {
      appToken: binding.baseAppToken,
      recordId: binding.recordId,
      tableId: binding.tableId,
    };

    const record = await runBaseEffect(
      FeishuBaseService.pipe(Effect.flatMap((svc) => svc.getRecord(params)))
    );

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

    await ctx.runMutation(internal.baseSyncActions.markSynced, {
      bindingId: args.bindingId,
    });
  },
});

// ── Reconcile: bidirectional conflict resolution ─────────────────────────

export const reconcileSync = internalAction({
  args: { bindingId: v.id("baseBindings") },
  handler: async (ctx, args) => {
    // Pull first (remote wins for base-owned fields), then push (app wins for app-owned fields)
    await ctx.runAction(internal.baseSyncActions.pullFromBase, {
      bindingId: args.bindingId,
    });
    await ctx.runAction(internal.baseSyncActions.syncProjectToBase, {
      bindingId: args.bindingId,
    });
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
    await ctx.db.patch(args.bindingId, { lastSyncedAt: Date.now() });
  },
});

export const applyProjectPatch = internalMutation({
  args: {
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
      objectId: args.projectId,
      objectType: "project",
      projectId: args.projectId,
    });
  },
});
