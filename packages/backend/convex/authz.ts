import { ConvexError } from "convex/values";

export type PermissionAction =
  | "project:read"
  | "project:write"
  | "project:create"
  | "comment:read"
  | "comment:write"
  | "work_item:read"
  | "work_item:write"
  | "approval:read"
  | "approval:write";

type DbCtx = {
  db: {
    get: (id: unknown) => Promise<any>;
    query: (table: string) => any;
    insert: (table: string, value: Record<string, unknown>) => Promise<unknown>;
  };
};

const rolePolicies: Record<string, PermissionAction[]> = {
  platform_admin: [
    "project:read",
    "project:write",
    "project:create",
    "comment:read",
    "comment:write",
    "work_item:read",
    "work_item:write",
    "approval:read",
    "approval:write",
  ],
  workspace_admin: [
    "project:read",
    "project:write",
    "project:create",
    "comment:read",
    "comment:write",
    "work_item:read",
    "work_item:write",
    "approval:read",
    "approval:write",
  ],
  owner: [
    "project:read",
    "project:write",
    "comment:read",
    "comment:write",
    "work_item:read",
    "work_item:write",
    "approval:read",
    "approval:write",
  ],
  contributor: [
    "project:read",
    "comment:read",
    "comment:write",
    "work_item:read",
    "work_item:write",
    "approval:read",
  ],
  viewer: ["project:read", "comment:read", "work_item:read", "approval:read"],
};

const includesAction = (actions: string[], action: PermissionAction): boolean =>
  actions.includes(action);

const mapProjectRoleToGlobalRole = (projectRole: string): string => {
  if (projectRole === "owner") return "owner";
  if (projectRole === "contributor") return "contributor";
  return "viewer";
};

const listUserRoles = async (
  ctx: DbCtx,
  userId: string,
  projectId?: unknown,
): Promise<string[]> => {
  const globalBindings = await ctx.db
    .query("roleBindings")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  const roles = new Set<string>(globalBindings.map((binding: any) => binding.role));

  if (projectId) {
    const projectMember = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q: any) =>
        q.eq("projectId", projectId).eq("userId", userId),
      )
      .first();

    if (projectMember) {
      roles.add(mapProjectRoleToGlobalRole(projectMember.role));
    }
  }

  return [...roles];
};

export const canAccessProject = async (
  ctx: DbCtx,
  userId: string,
  projectId: unknown,
  action: PermissionAction,
): Promise<boolean> => {
  const project = await ctx.db.get(projectId);
  if (!project) {
    return false;
  }

  const roles = await listUserRoles(ctx, userId, projectId);
  if (roles.some((role) => includesAction(rolePolicies[role] ?? [], action))) {
    return true;
  }

  const deptGrants = await ctx.db
    .query("departmentAuthorizations")
    .withIndex("by_department_user", (q: any) =>
      q.eq("departmentId", project.departmentId).eq("userId", userId),
    )
    .collect();

  if (deptGrants.some((grant: any) => includesAction(grant.permissions ?? [], action))) {
    return true;
  }

  const policy = await ctx.db
    .query("policyConfigurations")
    .withIndex("by_policy_key", (q: any) => q.eq("policyKey", action))
    .first();

  if (policy && policy.enabled && Array.isArray(policy.allowedRoles)) {
    return roles.some((role) => policy.allowedRoles.includes(role));
  }

  return false;
};

export const assertProjectPermission = async (
  ctx: DbCtx,
  params: {
    userId: string;
    projectId: unknown;
    action: PermissionAction;
    objectType: string;
    objectId: string;
  },
): Promise<void> => {
  const allowed = await canAccessProject(ctx, params.userId, params.projectId, params.action);
  if (allowed) {
    return;
  }

  const deniedReason = `User ${params.userId} is not allowed to perform ${params.action}`;
  await ctx.db.insert("auditEvents", {
    projectId: params.projectId,
    actorId: params.userId,
    action: "permission.denied",
    objectType: params.objectType,
    objectId: params.objectId,
    changeSummary: deniedReason,
    deniedReason,
  });

  throw new ConvexError({
    code: "AUTHZ_DENIED",
    message: deniedReason,
  });
};

export const listAccessibleProjects = async (
  ctx: DbCtx,
  userId: string,
  projects: any[],
  action: PermissionAction,
): Promise<any[]> => {
  const results = await Promise.all(
    projects.map(async (project) => {
      const allowed = await canAccessProject(ctx, userId, project._id, action);
      return allowed ? project : null;
    }),
  );

  return results.filter((project): project is any => project !== null);
};
