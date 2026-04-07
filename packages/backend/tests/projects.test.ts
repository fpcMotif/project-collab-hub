import { describe, expect, it, vi, beforeEach } from "vitest";

// oxlint-disable-next-line import/consistent-type-specifier-style
import { updateStatus } from "../convex/projects";

// Mock the Convex mutation wrapper to just return the passed configuration object
vi.mock("../convex/_generated/server", () => ({
  mutation: vi.fn().mockImplementation((opts) => opts),
  query: vi.fn().mockImplementation((opts) => opts),
}));

// We only want to test the updateStatus handler, so we can cast it as any to access the handler directly
// oxlint-disable-next-line typescript-eslint/no-explicit-any
const { handler } = updateStatus as any;

describe("projects - updateStatus mutation", () => {
  // oxlint-disable-next-line typescript-eslint/no-explicit-any
  let mockCtx: any;

  beforeEach(() => {
    mockCtx = {
      db: {
        get: vi.fn(),
        insert: vi.fn(),
        patch: vi.fn(),
      },
    };
  });

  it("should successfully update a project's status and create an audit event", async () => {
    // Mock that the project exists
    const mockProjectId = "mock-project-id";
    const mockProject = {
      _id: mockProjectId,
      status: "new",
    };
    mockCtx.db.get.mockResolvedValue(mockProject);
    mockCtx.db.patch.mockResolvedValue();
    mockCtx.db.insert.mockResolvedValue("mock-audit-event-id");

    const args = {
      actorId: "test-actor-123",
      id: mockProjectId,
      // Testing status change
      status: "in_progress",
    };

    await handler(mockCtx, args);

    // Verify it looked up the project
    expect(mockCtx.db.get).toHaveBeenCalledWith(args.id);

    // Verify it patched the project status
    expect(mockCtx.db.patch).toHaveBeenCalledWith(args.id, {
      status: args.status,
    });

    // Verify it inserted the audit event
    expect(mockCtx.db.insert).toHaveBeenCalledWith("auditEvents", {
      action: "project.status_changed",
      actorId: args.actorId,
      changeSummary: `Status changed from ${mockProject.status} to ${args.status}`,
      objectId: args.id,
      objectType: "project",
      projectId: args.id,
    });
  });

  it("should throw an error if the project is not found", async () => {
    // Mock that the project does not exist
    mockCtx.db.get.mockResolvedValue(null);

    const args = {
      actorId: "test-actor-123",
      id: "non-existent-id",
      status: "in_progress",
    };

    // Expect the handler to throw an error
    await expect(handler(mockCtx, args)).rejects.toThrowError(
      `Project ${args.id} not found`
    );

    // Verify patch and insert were NOT called
    expect(mockCtx.db.patch).not.toHaveBeenCalled();
    expect(mockCtx.db.insert).not.toHaveBeenCalled();
  });
});
