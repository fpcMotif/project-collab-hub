import { Data } from "effect";

export class SyncError extends Data.TaggedError("SyncError")<{
  readonly message: string;
  readonly bindingId: string;
  readonly attempt: number;
  readonly cause?: unknown;
}> {}
