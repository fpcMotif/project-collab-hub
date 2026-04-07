import { Layer } from "effect";

import { FeishuApprovalServiceLive } from "../services/feishu-approval-service.js";
import { FeishuAuthServiceLive } from "../services/feishu-auth-service.js";
import type { FeishuAuthConfig } from "../services/feishu-auth-service.js";
import { FeishuBaseServiceLive } from "../services/feishu-base-service.js";
import { FeishuChatServiceLive } from "../services/feishu-chat-service.js";
import { FeishuMessageServiceLive } from "../services/feishu-message-service.js";
import { FeishuTaskServiceLive } from "../services/feishu-task-service.js";
import { FeishuWorkflowServiceLive } from "../services/feishu-workflow-service.js";
import { FeishuUserServiceLive } from "../services/feishu-user-service.js";

export const FeishuLive = (config: FeishuAuthConfig) => {
  const authLayer = FeishuAuthServiceLive(config);

  return Layer.mergeAll(
    authLayer,
    Layer.provide(FeishuMessageServiceLive, authLayer),
    Layer.provide(FeishuApprovalServiceLive, authLayer),
    Layer.provide(FeishuTaskServiceLive, authLayer),
    Layer.provide(FeishuChatServiceLive, authLayer),
    Layer.provide(FeishuBaseServiceLive, authLayer),
    Layer.provide(FeishuWorkflowServiceLive, authLayer),
    Layer.provide(FeishuUserServiceLive, authLayer)
  );
};
