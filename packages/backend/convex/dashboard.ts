import { query } from "./_generated/server";

export const projectBoardData = query({
  args: {},
  handler: async (ctx) => {
    const [projects, departmentTracks, approvalGates, workItems] = await Promise.all([
      ctx.db.query("projects").collect(),
      ctx.db.query("departmentTracks").collect(),
      ctx.db.query("approvalGates").collect(),
      ctx.db.query("workItems").collect(),
    ]);

    const departmentStatusSummary = departmentTracks.reduce<Record<string, number>>(
      (acc, track) => {
        acc[track.status] = (acc[track.status] ?? 0) + 1;
        return acc;
      },
      {},
    );

    const pendingApprovalCount = approvalGates.filter(
      (gate) => gate.status === "pending",
    ).length;

    const latestApprovalStatusByProject = approvalGates.reduce<Record<string, string>>(
      (acc, gate) => {
        const projectId = String(gate.projectId);
        if (!acc[projectId] || gate.status === "pending") {
          acc[projectId] = gate.status;
        }
        return acc;
      },
      {},
    );

    const now = Date.now();
    const overdueTaskCount = workItems.filter(
      (item) => item.status !== "done" && item.dueDate !== undefined && item.dueDate < now,
    ).length;

    const overdueProjectIds = [
      ...new Set(
        workItems
          .filter(
            (item) =>
              item.status !== "done" && item.dueDate !== undefined && item.dueDate < now,
          )
          .map((item) => String(item.projectId)),
      ),
    ];

    return {
      projects,
      departmentStatusSummary,
      pendingApprovalCount,
      overdueTaskCount,
      latestApprovalStatusByProject,
      overdueProjectIds,
    };
  },
});
