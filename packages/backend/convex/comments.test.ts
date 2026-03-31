import { expect, test, describe } from "vitest";

// We need to mock the convex server and values to bypass the need for code generation
import { vi } from "vitest";

vi.mock("./_generated/server", () => {
  return {
    query: vi.fn((config) => config),
    mutation: vi.fn((config) => config),
  };
});

// Assuming comments.ts exports handlers via mutation/query which we mocked above
import * as comments from "./comments";

describe("comments.softDelete", () => {
  test("throws an error when comment is not found", async () => {
    // comments.softDelete is now the config object passed to mutation()
    const handler = (comments.softDelete as any).handler;

    const mockCtx = {
      db: {
        get: vi.fn().mockResolvedValue(null),
        patch: vi.fn(),
        insert: vi.fn(),
      },
    };

    const args = {
      id: "non-existent-id",
      actorId: "test-actor-id",
    };

    await expect(() => handler(mockCtx, args)).rejects.toThrow(
      `Comment ${args.id} not found`
    );

    expect(mockCtx.db.get).toHaveBeenCalledWith(args.id);
    expect(mockCtx.db.patch).not.toHaveBeenCalled();
    expect(mockCtx.db.insert).not.toHaveBeenCalled();
  });
});
