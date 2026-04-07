import { describe, expect, it, vi, beforeEach } from "vitest";

import { createFromTemplate } from "../convex/projects";

// The components in projects.ts import mutation/query from "./_generated/server"
// which delegates to convex/server. We need to mock the local module.
vi.mock("../convex/_generated/server", () => ({
  mutation: (config: { handler: unknown }) => config.handler,
  query: (config: { handler: unknown }) => config.handler,
}));

vi.mock("convex/values", () => ({
  v: {
    array: vi.fn(),
    boolean: vi.fn(),
    id: vi.fn(),
    literal: vi.fn(),
    number: vi.fn(),
    object: vi.fn(),
    optional: vi.fn(),
    string: vi.fn(),
    union: vi.fn(),
  },
}));

// We need to mock the imported internal api object
vi.mock("../convex/_generated/api", () => ({
  internal: {
    feishuActions: {
      createProjectChat: "createProjectChat_mock_action",
    },
  },
}));

describe("projects mutation: createFromTemplate", () => {
  let mockCtx: {
    db: {
      get: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
    };
    scheduler: {
      runAfter: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    mockCtx = {
      db: {
        get: vi.fn(),
        insert: vi.fn(),
      },
      scheduler: {
        runAfter: vi.fn(),
      },
    };

    // Clear all mocks
    vi.clearAllMocks();
  });

  it("creates a project and related records successfully without auto-chat", async () => {
    // Setup mock template
    const mockTemplateId = "template123";
    const mockProjectId = "project123";

    const mockTemplate = {
      _id: mockTemplateId,
      chatPolicy: {
        autoCreateChat: false,
      },
      defaultPriority: "medium",
      departments: [
        {
          defaultOwnerId: "user_bob",
          departmentId: "dept_eng",
          departmentName: "Engineering",
          isRequired: true,
        },
        {
          departmentId: "dept_design",
          departmentName: "Design",
          isRequired: false,
        },
      ],
      name: "Standard Implementation",
      version: 1,
    };

    mockCtx.db.get.mockResolvedValue(mockTemplate);
    mockCtx.db.insert.mockImplementation((table: string) => {
      if (table === "projects") {
        return Promise.resolve(mockProjectId);
      }
      return Promise.resolve(`mock_id_for_${table}`);
    });

    // Define args
    const args = {
      createdBy: "user_alice",
      departmentId: "dept_sales",
      description: "New client onboarding",
      name: "Acme Corp Implementation",
      ownerId: "user_alice",
      sourceEntry: "workbench",
      templateId: mockTemplateId,
    };

    // Execute handler
    // Typecast since we've mocked the wrapper away
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (createFromTemplate as any)(mockCtx, args);

    // Assert results
    expect(result).toEqual({
      projectId: mockProjectId,
      templateName: mockTemplate.name,
      templateVersion: mockTemplate.version,
    });

    // Assert database calls
    expect(mockCtx.db.get).toHaveBeenCalledWith(mockTemplateId);

    // Verify project insertion
    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "projects",
      expect.objectContaining({
        createdBy: args.createdBy,
        departmentId: args.departmentId,
        description: args.description,
        name: args.name,
        ownerId: args.ownerId,
        // Fallback to template default
        priority: "medium",
        sourceEntry: args.sourceEntry,
        status: "new",
        templateId: mockTemplateId,
        templateVersion: 1,
      })
    );

    // Verify department tracks insertion
    expect(mockCtx.db.insert).toHaveBeenCalledWith("departmentTracks", {
      departmentId: "dept_eng",
      departmentName: "Engineering",
      isRequired: true,
      ownerId: "user_bob",
      projectId: mockProjectId,
      status: "not_started",
    });
    expect(mockCtx.db.insert).toHaveBeenCalledWith("departmentTracks", {
      departmentId: "dept_design",
      departmentName: "Design",
      isRequired: false,
      ownerId: undefined,
      projectId: mockProjectId,
      status: "not_required",
    });

    // Verify audit event
    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "auditEvents",
      expect.objectContaining({
        action: "project.created",
        actorId: args.createdBy,
        objectId: mockProjectId,
        objectType: "project",
        projectId: mockProjectId,
      })
    );

    // Verify chat was NOT created
    expect(mockCtx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("creates a project and schedules chat creation when template dictates", async () => {
    // Setup mock template
    const mockTemplateId = "template456";
    const mockProjectId = "project456";

    const mockTemplate = {
      _id: mockTemplateId,
      chatPolicy: {
        autoCreateChat: true,
        chatNameTemplate: "Sync: {{name}}",
      },
      defaultPriority: "high",
      departments: [],
      name: "Complex Implementation",
      version: 2,
    };

    mockCtx.db.get.mockResolvedValue(mockTemplate);
    mockCtx.db.insert.mockResolvedValue(mockProjectId);

    // Define args
    const args = {
      createdBy: "user_alice",
      departmentId: "dept_sales",
      description: "Chat testing",
      name: "Acme Corp App",
      ownerId: "user_owner",
      sourceEntry: "api",
      templateId: mockTemplateId,
    };

    // Execute handler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (createFromTemplate as any)(mockCtx, args);

    // Verify chat creation was scheduled
    expect(mockCtx.scheduler.runAfter).toHaveBeenCalledWith(
      0,
      "createProjectChat_mock_action",
      {
        description: `Auto-created chat for project "${args.name}"`,
        name: `Sync: ${args.name}`,
        ownerOpenId: args.ownerId,
        projectId: mockProjectId,
        userOpenIds: [],
      }
    );
  });

  it("throws an error if the template does not exist", async () => {
    // Setup mock template not found
    const mockTemplateId = "invalid_template";
    mockCtx.db.get.mockResolvedValue(null);

    // Define args
    const args = {
      createdBy: "user_alice",
      departmentId: "dept_sales",
      description: "Error testing",
      name: "Acme Corp App",
      ownerId: "user_owner",
      sourceEntry: "api",
      templateId: mockTemplateId,
    };

    // Execute handler and assert rejection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((createFromTemplate as any)(mockCtx, args)).rejects.toThrow(
      `Template ${mockTemplateId} not found`
    );

    // Verify no insertions or scheduling occurred
    expect(mockCtx.db.insert).not.toHaveBeenCalled();
    expect(mockCtx.scheduler.runAfter).not.toHaveBeenCalled();
  });
});
