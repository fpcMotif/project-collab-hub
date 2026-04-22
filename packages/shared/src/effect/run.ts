import type { Layer } from "effect";
import { Effect, Logger, LogLevel } from "effect";

/**
 * Bridge between Effect and Promise worlds — provides a Layer and runs to Promise.
 * Used by Convex actions that need to call Effect-based services.
 */
export const runEffect = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  layer: Layer.Layer<R>
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(layer),
      Logger.withMinimumLogLevel(LogLevel.Warning)
    )
  );
