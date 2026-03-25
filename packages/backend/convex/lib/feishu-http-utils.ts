import type { Id } from "../_generated/dataModel";

/** Convex document ids are 32 lowercase alphanumeric chars. */
export const CONVEX_WORK_ITEM_ID_RE = /^[a-z0-9]{32}$/;

export const isValidConvexWorkItemId = (
  value: string
): value is Id<"workItems"> => CONVEX_WORK_ITEM_ID_RE.test(value);

/**
 * Feishu Base bitable record-change payloads may put `record_id` on the event
 * or inside `action_list[0].record_id`.
 */
export const extractBaseRecordIdFromEvent = (
  event: Record<string, unknown>
): string | undefined => {
  const direct = event.record_id as string | undefined;
  if (direct) {
    return direct;
  }

  const actionList = event.action_list as { record_id?: string }[] | undefined;

  return actionList?.[0]?.record_id;
};
