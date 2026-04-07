import type { DeptTrackStatus, SlaRisk } from "@/features/board/types";

import type {
  ProjectDetailDepartmentTrack,
  ProjectDetailWorkItem,
  ProjectDetailTimelineEvent,
} from "../types";

const ACTION_ACTOR_ID = "web_app.user";

export const getNextTrackStatusFromWorkItems = (
  track: ProjectDetailDepartmentTrack,
  workItems: ProjectDetailWorkItem[]
): DeptTrackStatus => {
  if (track.status === "blocked" || track.status === "waiting_approval") {
    return track.status;
  }

  const relatedItems = workItems.filter(
    (item) => item.departmentTrackId === track.id
  );
  if (relatedItems.length === 0) {
    return track.status;
  }

  if (relatedItems.every((item) => item.status === "done")) {
    return "done";
  }

  if (
    relatedItems.some(
      (item) => item.status === "in_progress" || item.status === "in_review"
    )
  ) {
    return "in_progress";
  }

  return "not_started";
};

export const deriveSlaRisk = (
  currentRisk: SlaRisk,
  overdueTaskCount: number
): SlaRisk => {
  if (overdueTaskCount > 0) {
    return "overdue";
  }

  return currentRisk === "overdue" ? "on_time" : currentRisk;
};

export const createTimelineEvent = (
  projectId: string,
  action: string,
  changeSummary: string
): ProjectDetailTimelineEvent => ({
  action,
  actorId: ACTION_ACTOR_ID,
  changeSummary,
  createdAt: Date.now(),
  id: `${projectId}-timeline-${Date.now()}`,
  objectId: projectId,
  objectType: "project",
  sourceEntry: "web",
});
