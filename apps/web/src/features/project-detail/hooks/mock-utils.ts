import type { DeptTrackStatus, SlaRisk } from "@/features/board/types";

import type {
  ProjectDetailData,
  ProjectDetailDepartmentTrack,
  ProjectDetailTimelineEvent,
  ProjectDetailWorkItem,
} from "../types";

export const COMMENT_AUTHOR_ID = "web_app.user";
export const ACTION_ACTOR_ID = "web_app.user";

export type ProjectDetailOverlay = Pick<
  ProjectDetailData,
  "departmentTracks" | "workItems" | "approvals" | "comments" | "timeline"
>;

export const getNextTrackStatusFromWorkItems = (
  track: Pick<ProjectDetailDepartmentTrack, "id" | "status">,
  workItems: ProjectDetailWorkItem[]
): DeptTrackStatus => {
  if (track.status === "done") {
    return "done";
  }
  const trackItems = workItems.filter(
    (item) => item.departmentTrackId === track.id
  );
  if (trackItems.length === 0) {
    return track.status;
  }
  if (trackItems.every((item) => item.status === "done")) {
    return "done";
  }
  return "in_progress";
};

export const deriveSlaRisk = (
  currentRisk: SlaRisk,
  overdueTaskCount: number
): SlaRisk => {
  if (overdueTaskCount > 0 && currentRisk === "on_time") {
    return "at_risk";
  }
  return currentRisk;
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
