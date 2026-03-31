import { Effect, Schedule } from "effect";
import type { Duration } from "effect";

/**
 * Exponential backoff with jitter — the gold standard for distributed retries.
 *
 * Starts at `base`, doubles each attempt, caps at `max`, adds ±25% jitter.
 * Stops after `maxAttempts` retries.
 */
export const exponentialBackoff = (options: {
  readonly base?: Duration.DurationInput;
  readonly max?: Duration.DurationInput;
  readonly maxAttempts?: number;
}) => {
  const base = options.base ?? "2 seconds";
  const max = options.max ?? "60 seconds";
  const maxAttempts = options.maxAttempts ?? 5;

  return Schedule.exponential(base, 2).pipe(
    Schedule.union(Schedule.spaced(max)),
    Schedule.intersect(Schedule.recurs(maxAttempts)),
    Schedule.jittered
  );
};

/**
 * Retry an effect with sensible defaults.
 * Only retries on transient errors — you control which via the `while` predicate.
 */
export const withRetry = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  options?: {
    readonly maxAttempts?: number;
    readonly while?: (error: E) => boolean;
  }
): Effect.Effect<A, E, R> => {
  const policy = exponentialBackoff({
    maxAttempts: options?.maxAttempts ?? 5,
  });

  return options?.while
    ? Effect.retry(effect, { schedule: policy, while: options.while })
    : Effect.retry(effect, policy);
};
