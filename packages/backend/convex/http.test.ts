import { describe, expect, it, afterEach, beforeEach } from "vitest";

import { verifyFeishuSignature } from "./http.js";

describe("verifyFeishuSignature", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return true when no key is configured", async () => {
    delete process.env.FEISHU_ENCRYPT_KEY;
    delete process.env.FEISHU_APP_SECRET;

    const request = new Request("http://localhost", {
      headers: {
        "X-Lark-Request-Nonce": "456",
        "X-Lark-Request-Timestamp": "123",
        "X-Lark-Signature": "abc",
      },
    });

    const result = await verifyFeishuSignature(request, "body");
    expect(result).toBe(true);
  });

  it("should return false when headers are missing", async () => {
    process.env.FEISHU_ENCRYPT_KEY = "test-key";

    const request = new Request("http://localhost", {
      headers: {
        "X-Lark-Request-Timestamp": "123",
        // missing nonce and signature
      },
    });

    const result = await verifyFeishuSignature(request, "body");
    expect(result).toBe(false);
  });

  it("should verify valid signature", async () => {
    process.env.FEISHU_ENCRYPT_KEY = "test-key";
    const timestamp = "1234567890";
    const nonce = "test-nonce";
    const body = '{"challenge":"123"}';

    const encoder = new TextEncoder();
    const data = encoder.encode(`${timestamp}${nonce}test-key${body}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = [...new Uint8Array(hashBuffer)];
    const validSignature = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const request = new Request("http://localhost", {
      headers: {
        "X-Lark-Request-Nonce": nonce,
        "X-Lark-Request-Timestamp": timestamp,
        "X-Lark-Signature": validSignature,
      },
    });

    const result = await verifyFeishuSignature(request, body);
    expect(result).toBe(true);
  });

  it("should reject invalid signature", async () => {
    process.env.FEISHU_ENCRYPT_KEY = "test-key";

    const request = new Request("http://localhost", {
      headers: {
        "X-Lark-Request-Nonce": "test-nonce",
        "X-Lark-Request-Timestamp": "1234567890",
        "X-Lark-Signature": "invalid-signature",
      },
    });

    const result = await verifyFeishuSignature(request, "body");
    expect(result).toBe(false);
  });

  it("should fallback to FEISHU_APP_SECRET if FEISHU_ENCRYPT_KEY is not set", async () => {
    delete process.env.FEISHU_ENCRYPT_KEY;
    process.env.FEISHU_APP_SECRET = "fallback-key";

    const timestamp = "1234567890";
    const nonce = "test-nonce";
    const body = '{"challenge":"123"}';

    const encoder = new TextEncoder();
    const data = encoder.encode(`${timestamp}${nonce}fallback-key${body}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = [...new Uint8Array(hashBuffer)];
    const validSignature = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const request = new Request("http://localhost", {
      headers: {
        "X-Lark-Request-Nonce": nonce,
        "X-Lark-Request-Timestamp": timestamp,
        "X-Lark-Signature": validSignature,
      },
    });

    const result = await verifyFeishuSignature(request, body);
    expect(result).toBe(true);
  });
});
