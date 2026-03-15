import { Layer } from "effect";
import {
  type FeishuAuthConfig,
  FeishuAuthServiceLive,
} from "../services/FeishuAuthService.js";
import { FeishuMessageServiceLive } from "../services/FeishuMessageService.js";

export const FeishuLive = (config: FeishuAuthConfig) =>
  FeishuAuthServiceLive(config).pipe(
    Layer.provideMerge(FeishuMessageServiceLive),
  );
