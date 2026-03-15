import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema.js";
import { anyApi } from "convex/server";
import { modules } from "./test.setup.js";

describe("approvalGates", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("should ignore if idempotencyKey exists", async () => {
    // 1. Setup: create a project
    const projectId = await t.run(async (ctx) => {
      return await ctx.db.insert("projects", {
        name: "Test Project",
        description: "Test",
        status: "new",
        ownerId: "user1",
        departmentId: "dept1",
        createdBy: "user1",
        sourceEntry: "workbench",
      });
    });

    // 2. Setup: create an approval gate
    const gateId = await t.mutation(anyApi.approvalGates.create, {
      projectId,
      triggerStage: "new",
      approvalCode: "CODE1",
      title: "Test Gate",
      applicantId: "user1",
    });

    // 3. Setup: create an audit event with the idempotencyKey
    await t.run(async (ctx) => {
      await ctx.db.insert("auditEvents", {
        projectId,
        actorId: "user2",
        action: "approval_gate.approved",
        objectType: "approval_gate",
        objectId: gateId,
        changeSummary: "already approved",
        idempotencyKey: "test-idempotency-key",
      });
    });

    // 4. Action: call resolve with the same idempotency key
    await t.mutation(anyApi.approvalGates.resolve, {
      id: gateId,
      instanceCode: "inst1",
      status: "approved",
      resolvedBy: "user2",
      idempotencyKey: "test-idempotency-key",
    });

    // 5. Verification: the gate should still be pending because the logic should have exited early
    const gate = await t.run(async (ctx) => {
      return await ctx.db.get(gateId);
    });

    expect(gate?.status).toBe("pending");
    expect(gate?.resolvedBy).toBeUndefined();
  });

  it("should process normally if idempotencyKey doesn't exist", async () => {
    const projectId = await t.run(async (ctx) => {
      return await ctx.db.insert("projects", {
        name: "Test Project",
        description: "Test",
        status: "new",
        ownerId: "user1",
        departmentId: "dept1",
        createdBy: "user1",
        sourceEntry: "workbench",
      });
    });

    const gateId = await t.mutation(anyApi.approvalGates.create, {
      projectId,
      triggerStage: "new",
      approvalCode: "CODE1",
      title: "Test Gate",
      applicantId: "user1",
    });

    await t.mutation(anyApi.approvalGates.resolve, {
      id: gateId,
      instanceCode: "inst1",
      status: "approved",
      resolvedBy: "user2",
      idempotencyKey: "new-idempotency-key",
    });

    const gate = await t.run(async (ctx) => {
      return await ctx.db.get(gateId);
    });

    expect(gate?.status).toBe("approved");
    expect(gate?.resolvedBy).toBe("user2");
  });
});
