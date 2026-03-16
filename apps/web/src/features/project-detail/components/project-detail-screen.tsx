"use client";

import { useConvexEnabled } from "@/providers/convex-client-provider";

import { useConvexProjectDetail } from "../hooks/use-convex-project-detail";
import { useMockProjectDetailState } from "../hooks/use-mock-project-detail-state";
import {
  ProjectDetailLoading,
  ProjectDetailNotFound,
  ProjectDetailView,
} from "./project-detail-view";

const ConnectedProjectDetailScreen = ({ projectId }: { projectId: string }) => {
  const detailState = useConvexProjectDetail(projectId);

  if (detailState.isLoading) {
    return <ProjectDetailLoading />;
  }

  if (!detailState.detail) {
    return <ProjectDetailNotFound projectId={projectId} />;
  }

  return (
    <ProjectDetailView
      detail={detailState.detail}
      onCreateComment={detailState.createComment}
      onDeleteComment={detailState.deleteComment}
      onUpdateWorkItemStatus={detailState.updateWorkItemStatus}
      onResolveApproval={detailState.resolveApproval}
    />
  );
};

const MockProjectDetailScreen = ({ projectId }: { projectId: string }) => {
  const detailState = useMockProjectDetailState(projectId);

  if (!detailState.detail) {
    return <ProjectDetailNotFound projectId={projectId} />;
  }

  return (
    <ProjectDetailView
      detail={detailState.detail}
      onCreateComment={detailState.createComment}
      onDeleteComment={detailState.deleteComment}
      onUpdateWorkItemStatus={detailState.updateWorkItemStatus}
      onResolveApproval={detailState.resolveApproval}
    />
  );
};

export const ProjectDetailScreen = ({ projectId }: { projectId: string }) => {
  const convexEnabled = useConvexEnabled();

  if (convexEnabled) {
    return <ConnectedProjectDetailScreen projectId={projectId} />;
  }

  return <MockProjectDetailScreen projectId={projectId} />;
};
