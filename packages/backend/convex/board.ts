import { query } from "./_generated/server";
import { v } from "convex/values";

const priority = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent"),
);

const approvalStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

export const getBoardData = query({
  args: {
    filters: v.optional(
      v.object({
        departments: v.optional(v.array(v.string())),
        owners: v.optional(v.array(v.string())),
        priorities: v.optional(v.array(priority)),
        approvalStatuses: v.optional(v.array(approvalStatus)),
        overdueOnly: v.optional(v.boolean()),
        customers: v.optional(v.array(v.string())),
        templateTypes: v.optional(v.array(v.string())),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const projects = await ctx.db.query("projects").collect();
    const departmentTracks = await ctx.db.query("departmentTracks").collect();
    const approvalGates = await ctx.db.query("approvalGates").collect();
    const workItems = await ctx.db.query("workItems").collect();
    const comments = await ctx.db.query("comments").collect();
    const auditEvents = await ctx.db.query("auditEvents").order("desc").take(500);

    const filters = args.filters;
    const now = Date.now();

    const byProjectDepartmentTracks = new Map();
    const byProjectApprovals = new Map();
    const byProjectWorkItems = new Map();
    const byProjectComments = new Map();
    const byProjectTimeline = new Map();

    for (const item of departmentTracks) {
      const list = byProjectDepartmentTracks.get(item.projectId) ?? [];
      list.push(item);
      byProjectDepartmentTracks.set(item.projectId, list);
    }

    for (const item of approvalGates) {
      const list = byProjectApprovals.get(item.projectId) ?? [];
      list.push(item);
      byProjectApprovals.set(item.projectId, list);
    }

    for (const item of workItems) {
      const list = byProjectWorkItems.get(item.projectId) ?? [];
      list.push(item);
      byProjectWorkItems.set(item.projectId, list);
    }

    for (const item of comments) {
      const list = byProjectComments.get(item.projectId) ?? [];
      list.push(item);
      byProjectComments.set(item.projectId, list);
    }

    for (const item of auditEvents) {
      const list = byProjectTimeline.get(item.projectId) ?? [];
      list.push(item);
      byProjectTimeline.set(item.projectId, list);
    }

    const projectsWithSummary = projects
      .map((project) => {
        const tracks = byProjectDepartmentTracks.get(project._id) ?? [];
        const approvals = byProjectApprovals.get(project._id) ?? [];
        const items = byProjectWorkItems.get(project._id) ?? [];
        const projectComments = byProjectComments.get(project._id) ?? [];
        const timeline = byProjectTimeline.get(project._id) ?? [];

        const pendingApprovals = approvals.filter((a) => a.status === "pending").length;
        const overdueTasks = items.filter(
          (w) => typeof w.dueDate === "number" && w.dueDate < now && w.status !== "done",
        ).length;
        const blockedCount = tracks.filter((t) => t.status === "blocked").length;
        const waitingApprovalCount = tracks.filter(
          (t) => t.status === "waiting_approval",
        ).length;

        const slaRisk =
          typeof project.slaDeadline === "number" && project.slaDeadline < now
            ? "critical"
            : overdueTasks > 0 || waitingApprovalCount > 0
              ? "warning"
              : "healthy";

        return {
          ...project,
          summary: {
            departmentStatus: {
              total: tracks.length,
              done: tracks.filter((t) => t.status === "done").length,
              inProgress: tracks.filter((t) => t.status === "in_progress").length,
              blocked: blockedCount,
              waitingApproval: waitingApprovalCount,
            },
            pendingApprovals,
            overdueTasks,
            slaRisk,
          },
          detail: {
            departmentWorkflow: tracks,
            actionItems: items,
            commentsCount: projectComments.filter((c) => !c.isDeleted).length,
            timeline: timeline.slice(0, 20),
          },
        };
      })
      .filter((project) => {
        if (!filters) return true;

        if (
          filters.departments?.length &&
          !filters.departments.includes(project.departmentId)
        ) {
          return false;
        }

        if (filters.owners?.length && !filters.owners.includes(project.ownerId)) {
          return false;
        }

        if (
          filters.priorities?.length &&
          (!project.priority || !filters.priorities.includes(project.priority))
        ) {
          return false;
        }

        if (
          filters.customers?.length &&
          (!project.customerName || !filters.customers.includes(project.customerName))
        ) {
          return false;
        }

        if (
          filters.templateTypes?.length &&
          (!project.templateId || !filters.templateTypes.includes(project.templateId))
        ) {
          return false;
        }

        if (filters.overdueOnly && project.summary.overdueTasks < 1) {
          return false;
        }

        if (filters.approvalStatuses?.length) {
          const approvals = byProjectApprovals.get(project._id) ?? [];
          if (!approvals.some((a) => filters.approvalStatuses?.includes(a.status))) {
            return false;
          }
        }

        return true;
      });

    const options = {
      departments: [...new Set(projects.map((project) => project.departmentId))],
      owners: [...new Set(projects.map((project) => project.ownerId))],
      customers: [
        ...new Set(
          projects
            .map((project) => project.customerName)
            .filter((value): value is string => typeof value === "string"),
        ),
      ],
      templateTypes: [
        ...new Set(
          projects
            .map((project) => project.templateId)
            .filter((value): value is string => typeof value === "string"),
        ),
      ],
    };

    return {
      projects: projectsWithSummary,
      options,
    };
  },
});
