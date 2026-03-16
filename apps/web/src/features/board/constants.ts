import { type BoardStatus } from "./types";

export const BOARD_COLUMNS: Array<{ status: BoardStatus; title: string }> = [
  { status: "new", title: "New" },
  { status: "assessment", title: "Assessment" },
  { status: "solution", title: "Solution" },
  { status: "ready", title: "Ready" },
  { status: "executing", title: "Executing" },
  { status: "delivering", title: "Delivering" },
  { status: "done", title: "Done" },
  { status: "cancelled", title: "Cancelled" },
];
