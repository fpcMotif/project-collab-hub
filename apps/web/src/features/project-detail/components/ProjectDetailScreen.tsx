"use client";

import { useConvexEnabled } from "@/providers/ConvexClientProvider";
import { useConvexProjectDetail } from "../hooks/useConvexProjectDetail";
import { useMockProjectDetailState } from "../hooks/useMockProjectDetailState";
import {
  ProjectDetailLoading,
  ProjectDetailNotFound,
  ProjectDetailView,
} from "./ProjectDetailView";

export function ProjectDetailScreen({ projectId }: { projectId: string }) {
  const convexEnabled = useConvexEnabled();

  if (convexEnabled) {
    return <ConnectedProjectDetailScreen projectId={projectId} />;
  }

  return <MockProjectDetailScreen projectId={projectId} />;
}

function ConnectedProjectDetailScreen({ projectId }: { projectId: string }) {
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
}

function MockProjectDetailScreen({ projectId }: { projectId: string }) {
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
}
