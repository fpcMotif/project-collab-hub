import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "feishu-event-retry-dispatch",
  { minutes: 1 },
  api.feishuEvents.dispatchDueEvents,
  { limit: 100 },
);

crons.interval(
  "feishu-state-reconcile",
  { minutes: 10 },
  api.feishuEvents.reconcileFeishuState,
  {},
);

export default crons;
