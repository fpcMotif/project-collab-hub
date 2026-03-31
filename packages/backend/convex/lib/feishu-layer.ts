import { FeishuLive } from "@collab-hub/feishu-integration";
import { runEffect } from "@collab-hub/shared/effect";
import type { Effect, Layer } from "effect";

const buildFeishuLayer = () => {
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

// Cached per Convex isolate — avoids rebuilding lark.Client on every call
let _layer: FeishuLayer | null = null;
const getLayer = (): FeishuLayer => {
  if (!_layer) {
    _layer = buildFeishuLayer();
  }
  return _layer;
};

export const runFeishu = <A>(
  effect: Effect.Effect<A, unknown, FeishuRequirements>
): Promise<A> => runEffect(effect, getLayer());
