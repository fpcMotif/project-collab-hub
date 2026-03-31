import type { Layer } from "effect";
import { Cause, Effect, Logger, LogLevel } from "effect";

/**
 * Run an Effect to a Promise, providing a Layer.
 * This is the standard bridge between Effect world and Promise world (e.g. Convex actions).
 *
 * @example
 * ```ts
 * const result = await runEffect(
 *   MyService.pipe(Effect.flatMap((svc) => svc.doThing(params))),
 *   buildMyLayer()
 * );
 * ```
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

/**
 * Run an Effect to a Promise and map errors to a structured result.
 * Perfect for mutation handlers that need `{ ok, message }` return shapes.
 *
 * @example
 * ```ts
 * return runEffectResult(
 *   transitionProject(params),
 *   layer,
 *   (error) => Cause.pretty(Cause.fail(error))
 * );
 * ```
 */
export const runEffectResult = async <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  layer: Layer.Layer<R>,
  formatError?: (error: E) => string
): Promise<{ ok: true; data: A } | { ok: false; message: string }> => {
  const exit = await Effect.runPromiseExit(
    effect.pipe(
      Effect.provide(layer),
      Logger.withMinimumLogLevel(LogLevel.Warning)
    )
  );

  if (exit._tag === "Success") {
    return { data: exit.value, ok: true };
  }

  const failure = Cause.failureOption(exit.cause);
  if (failure._tag === "Some") {
    const message = formatError
      ? formatError(failure.value)
      : String(failure.value);
    return { message, ok: false };
  }

  return { message: Cause.pretty(exit.cause), ok: false };
};
