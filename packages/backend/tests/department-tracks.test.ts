import { describe, expect, it, vi } from "vitest";

import { listByProject } from "../convex-modules/department-tracks";

// Need to mock convex-related values FIRST
vi.mock("convex/values", () => ({
  v: {
    boolean: () => ({}),
    id: () => ({}),
    literal: () => ({}),
    number: () => ({}),
    optional: () => ({}),
    string: () => ({}),
    union: () => ({}),
  },
}));

// Mock convex module before importing the file that uses it
vi.mock("../convex/_generated/server", () => ({
  mutation: (config: { handler: unknown }) => config.handler,
  query: (config: { handler: unknown }) => config.handler,
}));

// Create a type-safe bypass for calling the mocked function
const listByProjectHandler = listByProject as unknown as (
  ctx: unknown,
  args: unknown
) => Promise<unknown>;

describe("department-tracks", () => {
  describe("listByProject", () => {
    it("should return matching tracks for a project", async () => {
      const mockProjectId = "123";
      const mockTracks = [
        { _id: "t1", projectId: mockProjectId, status: "not_started" },
        { _id: "t2", projectId: mockProjectId, status: "done" },
      ];

      const collectMock = vi.fn().mockResolvedValue(mockTracks);
      const withIndexMock = vi.fn().mockReturnValue({ collect: collectMock });
      const queryMock = vi.fn().mockReturnValue({ withIndex: withIndexMock });

      const ctxMock = {
        db: {
          query: queryMock,
        },
      };

      const argsMock = { projectId: mockProjectId };

      // listByProject is the handler function because of how we mocked `query`
      const result = await listByProjectHandler(ctxMock, argsMock);

      expect(queryMock).toHaveBeenCalledWith("departmentTracks");

      // Verify withIndex was called correctly
      expect(withIndexMock).toHaveBeenCalled();
      const [[indexName, indexFn]] = withIndexMock.mock.calls;
      expect(indexName).toBe("by_project");

      // Verify the index builder callback
      const eqMock = vi.fn();
      const qMock = { eq: eqMock };
      indexFn(qMock);
      expect(eqMock).toHaveBeenCalledWith("projectId", mockProjectId);

      expect(collectMock).toHaveBeenCalled();
      expect(result).toEqual(mockTracks);
    });

    it("should return an empty array when no tracks exist for project", async () => {
      const mockProjectId = "123";
      const mockTracks: unknown[] = [];

      const collectMock = vi.fn().mockResolvedValue(mockTracks);
      const withIndexMock = vi.fn().mockReturnValue({ collect: collectMock });
      const queryMock = vi.fn().mockReturnValue({ withIndex: withIndexMock });

      const ctxMock = {
        db: {
          query: queryMock,
        },
      };

      const argsMock = { projectId: mockProjectId };

      const result = await listByProjectHandler(ctxMock, argsMock);

      expect(queryMock).toHaveBeenCalledWith("departmentTracks");
      expect(collectMock).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });
});
