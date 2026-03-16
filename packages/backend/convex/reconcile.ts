import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";

const FEISHU_TENANT_ACCESS_TOKEN = process.env.FEISHU_TENANT_ACCESS_TOKEN;

async function fetchApprovalStatus(instanceCode: string) {
  if (!FEISHU_TENANT_ACCESS_TOKEN) {
    return null;
  }

  const response = await fetch(
    `https://open.feishu.cn/open-apis/approval/v4/instances/${instanceCode}`,
    {
      headers: {
        Authorization: `Bearer ${FEISHU_TENANT_ACCESS_TOKEN}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Approval status request failed: ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const instance = data.data as Record<string, unknown> | undefined;
  return (instance?.status as string | undefined) ?? null;
}

async function fetchTaskStatus(taskGuid: string) {
  if (!FEISHU_TENANT_ACCESS_TOKEN) {
    return null;
  }

  const response = await fetch(
    `https://open.feishu.cn/open-apis/task/v2/tasks/${taskGuid}`,
    {
      headers: {
        Authorization: `Bearer ${FEISHU_TENANT_ACCESS_TOKEN}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Task status request failed: ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const task = data.data as Record<string, unknown> | undefined;
  return (task?.status as string | undefined) ?? null;
}

export const reconcileFeishuState = internalAction({
  args: {},
  handler: async (ctx) => {
    const pendingGates = await ctx.runQuery(api.approvalGates.listPending, {});
    for (const gate of pendingGates) {
      if (!gate.instanceCode) continue;
      try {
        const remoteStatus = await fetchApprovalStatus(gate.instanceCode);
        if (!remoteStatus) continue;

        if (remoteStatus === "APPROVED" || remoteStatus === "REJECTED") {
          await ctx.runMutation(api.approvalGates.resolve, {
            id: gate._id,
            instanceCode: gate.instanceCode,
            status: remoteStatus === "APPROVED" ? "approved" : "rejected",
            resolvedBy: "reconcile_job",
            idempotencyKey: `reconcile:approval:${gate.instanceCode}:${remoteStatus}`,
          });

          await ctx.runMutation(internal.reconcile.recordReconcileAudit, {
            entityType: "approval_instance",
            entityId: gate.instanceCode,
            driftReason: `Local pending corrected to ${remoteStatus}`,
          });
        }
      } catch (error) {
        await ctx.runMutation(internal.reconcile.recordReconcileAudit, {
          entityType: "approval_instance",
          entityId: gate.instanceCode,
          driftReason: error instanceof Error ? error.message : "Unknown reconcile error",
        });
      }
    }

    const taskBindings = await ctx.runQuery(api.feishuTaskBindings.listAll, {});
    for (const binding of taskBindings) {
      try {
        const remoteStatus = await fetchTaskStatus(binding.feishuTaskGuid);
        if (!remoteStatus || remoteStatus === binding.feishuTaskStatus) continue;

        await ctx.runMutation(api.feishuTaskBindings.updateSyncStatus, {
          id: binding._id,
          feishuTaskStatus: remoteStatus,
        });

        await ctx.runMutation(internal.reconcile.recordReconcileAudit, {
          entityType: "task",
          entityId: binding.feishuTaskGuid,
          driftReason: `Task status corrected from ${binding.feishuTaskStatus} to ${remoteStatus}`,
        });
      } catch (error) {
        await ctx.runMutation(internal.reconcile.recordReconcileAudit, {
          entityType: "task",
          entityId: binding.feishuTaskGuid,
          driftReason: error instanceof Error ? error.message : "Unknown reconcile error",
        });
      }
    }
  },
});

export const recordReconcileAudit = internalMutation({
  args: {
    entityType: v.union(v.literal("approval_instance"), v.literal("task")),
    entityId: v.string(),
    driftReason: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("reconcileAudits", {
      entityType: args.entityType,
      entityId: args.entityId,
      driftReason: args.driftReason,
      createdAt: Date.now(),
    });
  },
});
