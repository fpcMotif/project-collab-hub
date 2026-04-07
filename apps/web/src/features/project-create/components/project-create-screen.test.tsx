import { render, screen, act, cleanup } from "@testing-library/react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { useMockProjectStore } from "@/features/board/hooks/use-mock-project-store";
import { useConvexEnabled } from "@/providers/convex-client-provider";

import { ProjectCreateScreen } from "./project-create-screen";

// Mock dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("@/providers/convex-client-provider", () => ({
  useConvexEnabled: vi.fn(),
}));

vi.mock("@/features/board/hooks/use-mock-project-store", () => ({
  useMockProjectStore: vi.fn(),
}));

// Mock ProjectCreateForm to expose onSubmit easily
vi.mock("./project-create-form", () => ({
  // oxlint-disable-next-line typescript-eslint/no-explicit-any
  ProjectCreateForm: ({ onSubmit, templates }: any) => (
    <div data-testid="project-create-form">
      <button
        data-testid="submit-btn"
        onClick={() =>
          onSubmit({
            customerName: "Test Customer",
            departmentId: "test-dept",
            description: "Test Description",
            name: "Test Name",
            ownerId: "test-owner",
            priority: "high",
            slaDeadline: "2023-12-31",
            templateId: templates[0]?.id || "test-template-id",
          })
        }
      >
        Submit
      </button>
      <button
        data-testid="submit-btn-invalid-template"
        onClick={() =>
          onSubmit({
            customerName: "Test Customer",
            departmentId: "test-dept",
            description: "Test Description",
            name: "Test Name",
            ownerId: "test-owner",
            priority: "high",
            slaDeadline: "2023-12-31",
            templateId: "invalid-template-id",
          })
        }
      >
        Submit Invalid Template
      </button>
    </div>
  ),
}));

describe("ProjectCreateScreen", () => {
  const mockRouterPush = vi.fn();
  const mockCreateProjectFromTemplate = vi.fn();
  const mockAddProject = vi.fn();

  beforeEach(() => {
    // oxlint-disable-next-line typescript-eslint/no-explicit-any
    vi.mocked(useRouter).mockReturnValue({ push: mockRouterPush } as any);
    vi.mocked(useMutation).mockReturnValue(mockCreateProjectFromTemplate);
    vi.mocked(useMockProjectStore).mockReturnValue({
      addProject: mockAddProject,
      projects: [],
      replaceProjects: vi.fn(),
      // oxlint-disable-next-line typescript-eslint/no-explicit-any
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe("Screen Toggle Logic", () => {
    it("renders ConnectedProjectCreateScreen when convex is enabled", () => {
      vi.mocked(useConvexEnabled).mockReturnValue(true);
      // Return empty templates to avoid loading state
      vi.mocked(useQuery).mockReturnValue([]);

      render(<ProjectCreateScreen />);

      expect(screen.getByTestId("project-create-form")).toBeInTheDocument();
      expect(useQuery).toHaveBeenCalled();
    });

    it("renders MockProjectCreateScreen when convex is disabled", () => {
      vi.mocked(useConvexEnabled).mockReturnValue(false);

      render(<ProjectCreateScreen />);

      expect(screen.getByTestId("project-create-form")).toBeInTheDocument();
      expect(useQuery).not.toHaveBeenCalled();
    });
  });

  describe("ConnectedProjectCreateScreen", () => {
    beforeEach(() => {
      vi.mocked(useConvexEnabled).mockReturnValue(true);
    });

    it("renders loading state when templates query is undefined", () => {
      vi.mocked(useQuery).mockReturnValue();

      const { container } = render(<ProjectCreateScreen />);

      expect(
        screen.queryByTestId("project-create-form")
      ).not.toBeInTheDocument();
      // The loading component has an animate-pulse class
      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("submits successfully and redirects", async () => {
      vi.mocked(useQuery).mockReturnValue([
        {
          _id: "test-template-id",
          approvalGates: [],
          defaultPriority: "high",
          departments: [],
          description: "Test",
          name: "Test Template",
          version: 1,
        },
      ]);
      mockCreateProjectFromTemplate.mockResolvedValue({
        projectId: "new-proj-id",
      });

      render(<ProjectCreateScreen />);

      await act(() => {
        screen.getByTestId("submit-btn").click();
      });

      expect(mockCreateProjectFromTemplate).toHaveBeenCalledWith({
        createdBy: "web_app.user",
        customerName: "Test Customer",
        departmentId: "test-dept",
        description: "Test Description",
        name: "Test Name",
        ownerId: "test-owner",
        priority: "high",
        slaDeadline: new Date("2023-12-31T09:00:00").getTime(),
        sourceEntry: "workbench",
        templateId: "test-template-id",
      });
      expect(mockRouterPush).toHaveBeenCalledWith("/projects/new-proj-id");
    });

    it("handles submission errors gracefully", async () => {
      vi.mocked(useQuery).mockReturnValue([
        {
          _id: "test-template-id",
          approvalGates: [],
          defaultPriority: "high",
          departments: [],
          description: "Test",
          name: "Test Template",
          version: 1,
        },
      ]);
      const mockError = new Error("Template validation failed");
      mockCreateProjectFromTemplate.mockRejectedValue(mockError);

      render(<ProjectCreateScreen />);

      await act(() => {
        screen.getByTestId("submit-btn").click();
      });

      expect(mockCreateProjectFromTemplate).toHaveBeenCalled();
      expect(mockRouterPush).not.toHaveBeenCalled();
    });
  });

  describe("MockProjectCreateScreen", () => {
    beforeEach(() => {
      vi.mocked(useConvexEnabled).mockReturnValue(false);
    });

    it("submits successfully and redirects to mock project", async () => {
      render(<ProjectCreateScreen />);

      await act(() => {
        screen.getByTestId("submit-btn").click();
      });

      expect(mockAddProject).toHaveBeenCalled();
      const [[addedProject]] = mockAddProject.mock.calls;
      expect(addedProject.name).toBe("Test Name");
      expect(mockRouterPush).toHaveBeenCalledWith(
        `/projects/${addedProject.id}`
      );
    });

    it("handles invalid template selection", async () => {
      render(<ProjectCreateScreen />);

      await act(() => {
        screen.getByTestId("submit-btn-invalid-template").click();
      });

      expect(mockAddProject).not.toHaveBeenCalled();
      expect(mockRouterPush).not.toHaveBeenCalled();
    });
  });
});
