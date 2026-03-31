import { Data } from "effect";

/**
 * Base application error — all domain errors extend this.
 * Tagged errors give you exhaustive pattern matching for free.
 */
export class AppError extends Data.TaggedError("AppError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
