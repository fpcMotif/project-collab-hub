import { insertAuditEvent, withAuditSource } from "./auditEvents";

export type ProjectAccessLevel = "read" | "write";
export type ActorRole =
  | "admin"
  | "project_manager"
  | "editor"
  | "member"
  | "viewer"
  | "guest";

export type ProjectPermissionInput = {
  projectId: string;
  actorId: string;
  actorDepartmentId?: string;
  actorRole?: ActorRole;
  sourceEntry?: string;
  sourceIp?: string;
};

export function canReadProject(
  project: { ownerId: string; departmentId: string },
  input: ProjectPermissionInput,
): boolean {
  if (project.ownerId === input.actorId) return true;
  if (input.actorDepartmentId && project.departmentId === input.actorDepartmentId) {
    return true;
  }

  return new Set<ActorRole>([
    "admin",
    "project_manager",
    "editor",
    "member",
    "viewer",
  ]).has(input.actorRole ?? "guest");
}

export function canWriteProject(
  project: { ownerId: string; departmentId: string },
  input: ProjectPermissionInput,
): boolean {
  if (project.ownerId === input.actorId) return true;
  if (
    input.actorDepartmentId &&
    project.departmentId === input.actorDepartmentId &&
    (input.actorRole === "project_manager" ||
      input.actorRole === "editor" ||
      input.actorRole === "member")
  ) {
    return true;
  }

  return new Set<ActorRole>(["admin", "project_manager", "editor"]).has(
    input.actorRole ?? "guest",
  );
}

export async function requireProjectAccess(
  ctx: any,
  input: ProjectPermissionInput,
  accessLevel: ProjectAccessLevel,
  attemptedAction: string,
) {
  const project = await ctx.db.get(input.projectId);
  if (!project) {
    throw new Error(`Project ${input.projectId} not found`);
  }

  const allowed =
    accessLevel === "write"
      ? canWriteProject(project, input)
      : canReadProject(project, input);

  if (!allowed) {
    await insertAuditEvent(ctx, {
      projectId: input.projectId,
      actorId: input.actorId,
      action: "authz.denied",
      objectType: "project",
      objectId: input.projectId,
      changeSummary: `Denied ${accessLevel} for ${attemptedAction}`,
      ...withAuditSource(input),
    });
    throw new Error(`Permission denied: ${attemptedAction}`);
  }

  return project;
}
