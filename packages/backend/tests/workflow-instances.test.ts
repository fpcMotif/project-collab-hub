import { describe, expect, it, vi, beforeEach } from "vitest";

// We need to mock the generated server modules
vi.mock("../convex/_generated/server", () => {
  return {
    query: vi.fn((def) => def),
    mutation: vi.fn((def) => def),
  };
});

// Mock values
vi.mock("convex/values", () => {
  return {
    v: {
      union: vi.fn(),
      literal: vi.fn(),
      id: vi.fn(),
      string: vi.fn(),
      optional: vi.fn(),
    },
  };
});

import { listByProject } from "../convex-modules/workflow-instances";

describe("workflow-instances", () => {
  describe("listByProject", () => {
    let mockCtx: any;
    let mockCollect: ReturnType<typeof vi.fn>;
    let mockEq: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockCollect = vi.fn();
      mockEq = vi.fn();

      const mockIndexChain = {
        withIndex: vi.fn((indexName, queryBuilder) => {
          // Execute the queryBuilder to call q.eq so we can assert on it
          const mockQ = { eq: mockEq };
          queryBuilder(mockQ);
          return { collect: mockCollect };
        }),
      };

      mockCtx = {
        db: {
          query: vi.fn().mockReturnValue(mockIndexChain),
        },
      };
    });

    it("returns correct list of workflow instances for a project", async () => {
      const mockInstances = [
        { _id: "instance1", projectId: "proj1", status: "pending" },
        { _id: "instance2", projectId: "proj1", status: "running" },
      ];
      mockCollect.mockResolvedValue(mockInstances);

      // Cast listByProject to the structure defined in the file
      const handler = (listByProject as any).handler;

      const result = await handler(mockCtx, { projectId: "proj1" });

      expect(mockCtx.db.query).toHaveBeenCalledWith("workflowInstances");
      // The withIndex captures the call, we just ensure it was made correctly
      // We check that eq was called with right args inside the index builder
      expect(mockEq).toHaveBeenCalledWith("projectId", "proj1");
      expect(mockCollect).toHaveBeenCalled();

      expect(result).toEqual(mockInstances);
    });

    it("returns empty list when project has no workflow instances", async () => {
      mockCollect.mockResolvedValue([]);

      const handler = (listByProject as any).handler;
      const result = await handler(mockCtx, { projectId: "proj_empty" });

      expect(mockEq).toHaveBeenCalledWith("projectId", "proj_empty");
      expect(result).toEqual([]);
    });

    it("only returns instances for the specified project", async () => {
      // In a mocked unit test, we just verify that the query parameters passed to the database
      // are exactly restricting by the given projectId. The actual filtering is done by Convex.
      const targetProjectId = "proj_target";
      const otherProjectId = "proj_other";

      const handler = (listByProject as any).handler;
      await handler(mockCtx, { projectId: targetProjectId });

      expect(mockEq).toHaveBeenCalledWith("projectId", targetProjectId);
      expect(mockEq).not.toHaveBeenCalledWith("projectId", otherProjectId);
    });
  });
});
