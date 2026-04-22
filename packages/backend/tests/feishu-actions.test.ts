import { beforeEach, describe, expect, it, vi } from "vitest";

// oxlint-disable-next-line eslint-plugin-import(first)
import type { Id } from "../convex/_generated/dataModel";

// Since patchApprovalInstanceCode is exported via internalMutation, it gets wrapped by Convex.
// We mock internalMutation to return the original options object so we can test the handler.
vi.mock("convex/server", async (importOriginal) => {
  const actual: unknown = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    action: vi.fn().mockImplementation((opts: unknown) => opts),
    httpAction: vi.fn().mockImplementation((opts: unknown) => opts),
    internalAction: vi.fn().mockImplementation((opts: unknown) => opts),
    internalMutation: vi.fn().mockImplementation((opts: unknown) => opts),
    internalQuery: vi.fn().mockImplementation((opts: unknown) => opts),
    mutation: vi.fn().mockImplementation((opts: unknown) => opts),
    query: vi.fn().mockImplementation((opts: unknown) => opts),
  };
});
vi.mock("../convex/_generated/server", async (importOriginal) => {
  const actual: unknown = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    action: vi.fn().mockImplementation((opts: unknown) => opts),
    httpAction: vi.fn().mockImplementation((opts: unknown) => opts),
    internalAction: vi.fn().mockImplementation((opts: unknown) => opts),
    internalMutation: vi.fn().mockImplementation((opts: unknown) => opts),
    internalQuery: vi.fn().mockImplementation((opts: unknown) => opts),
    mutation: vi.fn().mockImplementation((opts: unknown) => opts),
    query: vi.fn().mockImplementation((opts: unknown) => opts),
  };
});

// Have to import after mocking convex/server
// oxlint-disable-next-line eslint-plugin-import(first)
import { patchApprovalInstanceCode } from "../convex/feishuActions";

describe("patchApprovalInstanceCode", () => {
  let mockCtx: { db: { patch: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    mockCtx = {
      db: {
        patch: vi.fn(),
      },
    };
  });

  it("successfully updates the instance code for an approval gate", async () => {
    mockCtx.db.patch.mockResolvedValue();

    const gateId = "12345" as Id<"approvalGates">;
    const instanceCode = "INST-CODE-789";

    // patchApprovalInstanceCode is now the options object passed to internalMutation
    await (
      patchApprovalInstanceCode as unknown as {
        handler: (
          ctx: typeof mockCtx,
          args: { gateId: Id<"approvalGates">; instanceCode: string }
        ) => Promise<void>;
      }
    ).handler(mockCtx, {
      gateId,
      instanceCode,
    });

    expect(mockCtx.db.patch).toHaveBeenCalledTimes(1);
    expect(mockCtx.db.patch).toHaveBeenCalledWith(gateId, {
      instanceCode,
    });
  });

  it("propagates errors if ctx.db.patch throws an error", async () => {
    const error = new Error("Document not found");
    mockCtx.db.patch.mockRejectedValue(error);

    const gateId = "missing-id" as Id<"approvalGates">;
    const instanceCode = "INST-CODE-789";

    await expect(
      (
        patchApprovalInstanceCode as unknown as {
          handler: (
            ctx: typeof mockCtx,
            args: { gateId: Id<"approvalGates">; instanceCode: string }
          ) => Promise<void>;
        }
      ).handler(mockCtx, {
        gateId,
        instanceCode,
      })
    ).rejects.toThrow("Document not found");

    expect(mockCtx.db.patch).toHaveBeenCalledTimes(1);
  });
});
