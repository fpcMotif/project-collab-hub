import { query } from "./_generated/server";
import { v } from "convex/values";

type AuditSource = {
  sourceEntry?: string;
  sourceIp?: string;
};

type AuditEventInput = {
  projectId?: string;
  actorId: string;
  action: string;
  objectType: string;
  objectId: string;
  changeSummary: string;
  idempotencyKey?: string;
} & AuditSource;

export function withAuditSource(source?: AuditSource): AuditSource {
  return {
    ...(source?.sourceEntry ? { sourceEntry: source.sourceEntry } : {}),
    ...(source?.sourceIp ? { sourceIp: source.sourceIp } : {}),
  };
}

export async function insertAuditEvent(ctx: any, input: AuditEventInput) {
  await ctx.db.insert("auditEvents", {
    ...input,
    ...withAuditSource(input),
  });
}

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("auditEvents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const listByActor = query({
  args: { actorId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("auditEvents")
      .withIndex("by_actor", (q) => q.eq("actorId", args.actorId))
      .order("desc")
      .collect();
  },
});
