import type { Doc } from "../_generated/dataModel";

export const projectToBaseFields = (
  project: Doc<"projects">,
  workItems: Doc<"workItems">[],
  departmentTracks: Doc<"departmentTracks">[]
): Record<string, unknown> => {
  const doneCount = workItems.filter((item) => item.status === "done").length;
  const totalCount = workItems.length;

  return {
    customer_name: project.customerName ?? "",
    department_count: departmentTracks.length,
    department_id: project.departmentId,
    description: project.description,
    end_date: project.endDate ?? null,
    name: project.name,
    owner_id: project.ownerId,
    priority: project.priority ?? "medium",
    progress: totalCount > 0 ? `${doneCount}/${totalCount}` : "0/0",
    sla_deadline: project.slaDeadline ?? null,
    start_date: project.startDate ?? null,
    status: project.status,
    task_done_count: doneCount,
    task_total_count: totalCount,
  };
};

export const baseFieldsToProjectPatch = (
  fields: Record<string, unknown>,
  fieldOwnership: Record<string, string>,
  currentProject: Doc<"projects">
): Record<string, unknown> => {
  const patch: Record<string, unknown> = {};

  const FIELD_MAP: Record<string, string> = {
    customer_name: "customerName",
    description: "description",
    end_date: "endDate",
    name: "name",
    owner_id: "ownerId",
    priority: "priority",
    sla_deadline: "slaDeadline",
    start_date: "startDate",
  };

  for (const [baseField, projectField] of Object.entries(FIELD_MAP)) {
    const owner = fieldOwnership[baseField];
    if (owner && owner !== "base") {
      continue;
    }

    if (baseField in fields) {
      const newValue = fields[baseField];
      const currentValue =
        currentProject[projectField as keyof typeof currentProject];

      if (newValue !== currentValue && newValue !== undefined) {
        patch[projectField] = newValue;
      }
    }
  }

  return patch;
};
