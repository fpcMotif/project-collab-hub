import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMockProjectStore } from "@/features/board/hooks/use-mock-project-store";
import type { BoardProjectRecord } from "@/features/board/types";

import { getMockProjectDetail } from "../mock-data";
import type {
  ProjectDetailData,
  ProjectDetailWorkItem,
  ProjectDetailDepartmentTrack,
} from "../types";
import { useMockProjectDetailState } from "./use-mock-project-detail-state";

vi.mock("@/features/board/hooks/use-mock-project-store");
vi.mock("../mock-data", () => ({
  getMockProjectDetail: vi.fn(),
}));

describe("useMockProjectDetailState", () => {
  const mockProjectId = "proj-123";

  const mockBaseDetail: ProjectDetailData = {
    approvals: [],
    comments: [],
    departmentTracks: [
      {
        blockReason: undefined,
        departmentName: "Engineering",
        id: "track-1",
        pendingApprovalCount: 0,
        status: "not_started",
      } as ProjectDetailDepartmentTrack,
    ],
    timeline: [],
    workItems: [
      {
        departmentTrackId: "track-1",
        id: "wi-1",
        status: "todo",
        title: "Task 1",
      } as ProjectDetailWorkItem,
    ],
  } as ProjectDetailData;

  const mockProjects: BoardProjectRecord[] = [
    {
      departmentTracks: [],
      id: mockProjectId,
      pendingApprovalCount: 0,
      slaRisk: "none",
    } as unknown as BoardProjectRecord,
  ];

  let replaceProjectsMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }

    replaceProjectsMock = vi.fn();
    vi.mocked(useMockProjectStore).mockReturnValue({
      projects: mockProjects,
      replaceProjects: replaceProjectsMock,
    } as unknown as ReturnType<typeof useMockProjectStore>);

    vi.mocked(getMockProjectDetail).mockReturnValue(mockBaseDetail);
  });

  describe("initialization", () => {
    it("should return base detail when initialized", () => {
      const { result } = renderHook(() =>
        useMockProjectDetailState(mockProjectId)
      );

      expect(result.current.detail).toEqual(mockBaseDetail);
      expect(result.current.isLoading).toBe(false);
      expect(getMockProjectDetail).toHaveBeenCalledWith(
        mockProjectId,
        mockProjects
      );
    });
  });

  describe("comments", () => {
    it("should create a comment", async () => {
      const { result } = renderHook(() =>
        useMockProjectDetailState(mockProjectId)
      );

      let res;
      await act(async () => {
        res = await result.current.createComment("Hello world!", ["user-1"]);
      });

      expect(res).toEqual({ message: "评论已保存", ok: true });
      expect(result.current.detail?.comments).toHaveLength(1);
      expect(result.current.detail?.comments[0]).toMatchObject({
        body: "Hello world!",
        isDeleted: false,
        mentionedUserIds: ["user-1"],
      });
      expect(result.current.detail?.timeline).toHaveLength(1);
      expect(result.current.detail?.timeline[0]?.changeSummary).toContain(
        "新增评论：Hello world!"
      );
    });

    it("should fail to create a comment if body is empty", async () => {
      const { result } = renderHook(() =>
        useMockProjectDetailState(mockProjectId)
      );

      let res;
      await act(async () => {
        res = await result.current.createComment("   ", []);
      });

      expect(res).toEqual({ message: "评论内容不能为空", ok: false });
      expect(result.current.detail?.comments).toHaveLength(0);
    });

    it("should delete a comment", async () => {
      const { result } = renderHook(() =>
        useMockProjectDetailState(mockProjectId)
      );

      await act(async () => {
        await result.current.createComment("To be deleted", []);
      });

      const commentId = result.current.detail?.comments[0]?.id;

      let res;
      await act(async () => {
        if (commentId) {
          res = await result.current.deleteComment(commentId);
        }
      });

      expect(res).toEqual({ message: "评论已删除", ok: true });
      expect(result.current.detail?.comments[0]?.isDeleted).toBe(true);
      expect(result.current.detail?.timeline[0]?.changeSummary).toBe(
        "评论已删除"
      );
    });
  });

  describe("work items", () => {
    it("should update a work item status and track status", async () => {
      const { result } = renderHook(() =>
        useMockProjectDetailState(mockProjectId)
      );

      let res;
      await act(async () => {
        res = await result.current.updateWorkItemStatus("wi-1", "done");
      });

      expect(res).toEqual({ message: "行动项状态已更新", ok: true });

      const updatedItem = result.current.detail?.workItems.find(
        (wi) => wi.id === "wi-1"
      );
      expect(updatedItem?.status).toBe("done");
      expect(updatedItem?.completedAt).toBeDefined();

      expect(result.current.detail?.timeline[0]?.changeSummary).toContain(
        "行动项「Task 1」更新为 done"
      );

      expect(replaceProjectsMock).toHaveBeenCalled();
    });

    it("should return false if work item does not exist", async () => {
      const { result } = renderHook(() =>
        useMockProjectDetailState(mockProjectId)
      );

      let res;
      await act(async () => {
        res = await result.current.updateWorkItemStatus(
          "wi-non-existent",
          "done"
        );
      });

      expect(res).toEqual({ message: "未找到行动项", ok: false });
    });
  });

  describe("approvals", () => {
    it("should request an approval", async () => {
      const { result } = renderHook(() =>
        useMockProjectDetailState(mockProjectId)
      );

      let res;
      await act(async () => {
        res = await result.current.requestApproval(
          "Approval 1",
          "code-1",
          "stage-1"
        );
      });

      expect(res).toEqual({ message: "审批申请已提交", ok: true });
      expect(result.current.detail?.approvals).toHaveLength(1);
      expect(result.current.detail?.approvals[0]).toMatchObject({
        approvalCode: "code-1",
        status: "pending",
        title: "Approval 1",
        triggerStage: "stage-1",
      });
      expect(result.current.detail?.timeline[0]?.changeSummary).toContain(
        "申请审批：Approval 1"
      );
    });

    it("should resolve an approval as approved", async () => {
      const { result } = renderHook(() =>
        useMockProjectDetailState(mockProjectId)
      );

      await act(async () => {
        await result.current.requestApproval("Approval 1", "code-1", "stage-1");
      });

      const approvalId = result.current.detail?.approvals[0]?.id;

      let res;
      await act(async () => {
        if (approvalId) {
          res = await result.current.resolveApproval(approvalId, "approved");
        }
      });

      expect(res).toEqual({ message: "审批已通过", ok: true });
      expect(result.current.detail?.approvals[0]?.status).toBe("approved");
      expect(result.current.detail?.timeline[0]?.changeSummary).toContain(
        "已通过"
      );
      expect(replaceProjectsMock).toHaveBeenCalled();
    });

    it("should resolve an approval as rejected", async () => {
      const { result } = renderHook(() =>
        useMockProjectDetailState(mockProjectId)
      );

      await act(async () => {
        await result.current.requestApproval(
          "Approval Reject",
          "code-1",
          "stage-1"
        );
      });

      const approvalId = result.current.detail?.approvals[0]?.id;

      let res;
      await act(async () => {
        if (approvalId) {
          res = await result.current.resolveApproval(approvalId, "rejected");
        }
      });

      expect(res).toEqual({ message: "审批已拒绝", ok: true });
      expect(result.current.detail?.approvals[0]?.status).toBe("rejected");
      expect(result.current.detail?.timeline[0]?.changeSummary).toContain(
        "已拒绝"
      );
    });

    it("should return false if resolving non-existent approval", async () => {
      const { result } = renderHook(() =>
        useMockProjectDetailState(mockProjectId)
      );

      let res;
      await act(async () => {
        res = await result.current.resolveApproval("non-existent", "approved");
      });

      expect(res).toEqual({ message: "未找到审批", ok: false });
    });
  });

  describe("empty detail state", () => {
    it("should handle operations gracefully when detail is null", async () => {
      vi.mocked(getMockProjectDetail).mockReturnValue(null);
      const { result } = renderHook(() =>
        useMockProjectDetailState(mockProjectId)
      );

      let resComment;
      let resWorkItem;
      let resApproval;
      let resResolve;

      await act(async () => {
        resComment = await result.current.createComment("Test", []);
        resWorkItem = await result.current.updateWorkItemStatus("wi-1", "done");
        resApproval = await result.current.requestApproval(
          "Title",
          "code",
          "stage"
        );
        resResolve = await result.current.resolveApproval("app-1", "approved");
      });

      expect(resComment).toEqual({ message: "评论内容不能为空", ok: false });
      expect(resWorkItem).toEqual({ message: "未找到项目详情", ok: false });
      expect(resApproval).toEqual({ message: "未找到项目详情", ok: false });
      expect(resResolve).toEqual({ message: "未找到项目详情", ok: false });
    });
  });
});
