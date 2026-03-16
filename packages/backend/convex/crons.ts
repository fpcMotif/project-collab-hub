import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "process-feishu-event-inbox",
  { minutes: 1 },
  internal.eventInbox.processDue,
  {},
);

crons.interval(
  "reconcile-feishu-state",
  { minutes: 10 },
  internal.reconcile.reconcileFeishuState,
  {},
);

export default crons;
