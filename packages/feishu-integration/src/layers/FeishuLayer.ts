import { Layer } from "effect";

import { FeishuApprovalServiceLive } from "../services/FeishuApprovalService.js";
import { FeishuAuthServiceLive } from "../services/FeishuAuthService.js";
import type { FeishuAuthConfig } from "../services/FeishuAuthService.js";
import { FeishuChatServiceLive } from "../services/FeishuChatService.js";
import { FeishuMessageServiceLive } from "../services/FeishuMessageService.js";
import { FeishuTaskServiceLive } from "../services/FeishuTaskService.js";

export const FeishuLive = (config: FeishuAuthConfig) => {
  const authLayer = FeishuAuthServiceLive(config);

  return Layer.mergeAll(
    authLayer,
    Layer.provide(FeishuMessageServiceLive, authLayer),
    Layer.provide(FeishuApprovalServiceLive, authLayer),
    Layer.provide(FeishuTaskServiceLive, authLayer),
    Layer.provide(FeishuChatServiceLive, authLayer)
  );
};
