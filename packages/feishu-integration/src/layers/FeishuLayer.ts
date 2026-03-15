import { Layer } from "effect";
import {
  type FeishuAuthConfig,
  FeishuAuthServiceLive,
} from "../services/FeishuAuthService.js";
import { FeishuMessageServiceLive } from "../services/FeishuMessageService.js";
import { FeishuApprovalServiceLive } from "../services/FeishuApprovalService.js";
import { FeishuTaskServiceLive } from "../services/FeishuTaskService.js";
import { FeishuChatServiceLive } from "../services/FeishuChatService.js";

export const FeishuLive = (config: FeishuAuthConfig) => {
  const authLayer = FeishuAuthServiceLive(config);

  return Layer.mergeAll(
    authLayer,
    Layer.provide(FeishuMessageServiceLive, authLayer),
    Layer.provide(FeishuApprovalServiceLive, authLayer),
    Layer.provide(FeishuTaskServiceLive, authLayer),
    Layer.provide(FeishuChatServiceLive, authLayer),
  );
};
