import { action, query, mutation } from "./_generated/server";
import { v } from "convex/values";

const STAGES = [
  "new",
  "assessment",
  "solution",
  "ready",
  "executing",
  "delivering",
  "done",
  "cancelled",
] as const;

function toCsvRow(values: Array<string | number | undefined>) {
  return values
    .map((value) => {
      const str = value === undefined ? "" : String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replaceAll('"', '""')}"`;
      }
      return str;
    })
    .join(",");
}

export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const [projects, approvals, workItems, tracks] = await Promise.all([
      ctx.db.query("projects").collect(),
      ctx.db.query("approvalGates").collect(),
      ctx.db.query("workItems").collect(),
      ctx.db.query("departmentTracks").collect(),
    ]);

    const stageFunnel = STAGES.map((stage) => ({
      stage,
      count: projects.filter((project) => project.status === stage).length,
    }));

    const resolvedApprovals = approvals.filter(
      (approval) => approval.status === "approved" || approval.status === "rejected",
    );
    const approvalDurations = resolvedApprovals
      .map((approval) =>
        approval.resolvedAt ? approval.resolvedAt - approval._creationTime : undefined,
      )
      .filter((duration): duration is number => duration !== undefined && duration >= 0);

    const approvalLeadTime = {
      resolvedCount: resolvedApprovals.length,
      averageHours:
        approvalDurations.length === 0
          ? 0
          : Number(
              (
                approvalDurations.reduce((total, duration) => total + duration, 0) /
                approvalDurations.length /
                3_600_000
              ).toFixed(2),
            ),
      p90Hours:
        approvalDurations.length === 0
          ? 0
          : Number(
              (
                [...approvalDurations].sort((a, b) => a - b)[
                  Math.max(0, Math.ceil(approvalDurations.length * 0.9) - 1)
                ] / 3_600_000
              ).toFixed(2),
            ),
    };

    const now = Date.now();
    const overdueBuckets: Record<string, number> = {
      "<=3d": 0,
      "4-7d": 0,
      "8-14d": 0,
      ">14d": 0,
    };

    for (const item of workItems) {
      if (!item.dueDate || item.status === "done") continue;
      if (item.dueDate >= now) continue;
      const overdueDays = Math.floor((now - item.dueDate) / 86_400_000);
      if (overdueDays <= 3) overdueBuckets["<=3d"] += 1;
      else if (overdueDays <= 7) overdueBuckets["4-7d"] += 1;
      else if (overdueDays <= 14) overdueBuckets["8-14d"] += 1;
      else overdueBuckets[">14d"] += 1;
    }

    const departmentMap = new Map<
      string,
      {
        departmentId: string;
        departmentName: string;
        total: number;
        inProgress: number;
        blocked: number;
        waitingApproval: number;
        overdue: number;
      }
    >();

    for (const track of tracks) {
      const key = track.departmentId;
      const entry = departmentMap.get(key) ?? {
        departmentId: track.departmentId,
        departmentName: track.departmentName,
        total: 0,
        inProgress: 0,
        blocked: 0,
        waitingApproval: 0,
        overdue: 0,
      };

      entry.total += 1;
      if (track.status === "in_progress") entry.inProgress += 1;
      if (track.status === "blocked") entry.blocked += 1;
      if (track.status === "waiting_approval") entry.waitingApproval += 1;
      if (track.dueDate && track.status !== "done" && track.dueDate < now) {
        entry.overdue += 1;
      }

      departmentMap.set(key, entry);
    }

    return {
      stageFunnel,
      approvalLeadTime,
      overdueTaskDistribution: Object.entries(overdueBuckets).map(([bucket, count]) => ({
        bucket,
        count,
      })),
      departmentLoad: [...departmentMap.values()].sort((a, b) => b.total - a.total),
    };
  },
});

export const exportProjectsCsv = action({
  args: {
    statuses: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const projects = await ctx.runQuery("projects:list" as never, {});
    const filtered = args.statuses?.length
      ? projects.filter((project) => args.statuses?.includes(project.status))
      : projects;

    const header = [
      "projectId",
      "name",
      "status",
      "departmentId",
      "ownerId",
      "priority",
      "startDate",
      "endDate",
      "slaDeadline",
    ];

    const rows = filtered.map((project) =>
      toCsvRow([
        project._id,
        project.name,
        project.status,
        project.departmentId,
        project.ownerId,
        project.priority,
        project.startDate,
        project.endDate,
        project.slaDeadline,
      ]),
    );

    return [toCsvRow(header), ...rows].join("\n");
  },
});

export const upsertBaseProjection = mutation({
  args: {
    projectId: v.id("projects"),
    baseAppToken: v.string(),
    tableId: v.string(),
    recordId: v.string(),
    fieldOwnership: v.optional(
      v.union(v.literal("app_owned"), v.literal("base_owned"), v.literal("shared")),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("baseBindings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();

    const payload = {
      projectId: args.projectId,
      baseAppToken: args.baseAppToken,
      tableId: args.tableId,
      recordId: args.recordId,
      projectionDirection: "app_to_base" as const,
      fieldOwnership: args.fieldOwnership,
      lastSyncedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return ctx.db.insert("baseBindings", payload);
  },
});
