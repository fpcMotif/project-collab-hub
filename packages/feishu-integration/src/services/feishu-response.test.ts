import { describe, expect, it } from "bun:test";

import { FeishuError } from "../errors/feishu-error.js";
import {
  assertFeishuSuccess,
  getFeishuData,
  getFeishuObjectData,
  wrapFeishuError,
} from "./feishu-response.js";

describe("feishu-response", () => {
  it("wrapFeishuError returns a FeishuError instance", () => {
    const error = wrapFeishuError(
      "Failed to send message",
      new Error("network error")
    );

    expect(error).toBeInstanceOf(FeishuError);
    expect(error.message).toBe("Failed to send message: network error");
  });

  it("assertFeishuSuccess throws FeishuError on unsuccessful response", () => {
    try {
      assertFeishuSuccess({ code: 999, msg: "permission denied" });
      throw new Error("Expected assertFeishuSuccess to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(FeishuError);
      expect((error as FeishuError).message).toBe(
        "Feishu API failed with code 999: permission denied"
      );
    }
  });

  it("getFeishuData throws FeishuError when no data is present", () => {
    try {
      getFeishuData({ code: 0 });
      throw new Error("Expected getFeishuData to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(FeishuError);
      expect((error as FeishuError).message).toBe("No data in response");
    }
  });

  it("getFeishuObjectData throws FeishuError when data is not an object", () => {
    try {
      getFeishuObjectData({ code: 0, data: "invalid" });
      throw new Error("Expected getFeishuObjectData to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(FeishuError);
      expect((error as FeishuError).message).toBe(
        "Expected object data in response"
      );
    }
  });
});
