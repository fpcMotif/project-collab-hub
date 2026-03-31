import { FeishuLive } from "@collab-hub/feishu-integration";
import { runEffect } from "@collab-hub/shared/effect";
import type { Effect, Layer } from "effect";

/**
 * Build the Feishu service layer from environment variables.
 * Single source of truth — every Convex action that calls Feishu uses this.
 */
export const buildFeishuLayer = () => {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error(
      "Missing FEISHU_APP_ID or FEISHU_APP_SECRET environment variables"
    );
  }

  return FeishuLive({ appId, appSecret });
};

type FeishuLayer = ReturnType<typeof buildFeishuLayer>;
type FeishuRequirements = Layer.Layer.Success<FeishuLayer>;

/**
 * Run a Feishu Effect to a Promise with the shared layer.
 * Drop-in replacement for the old `runBaseEffect` / `runFeishuEffect`.
 */
export const runFeishu = <A>(
  effect: Effect.Effect<A, unknown, FeishuRequirements>
): Promise<A> => runEffect(effect, buildFeishuLayer());
