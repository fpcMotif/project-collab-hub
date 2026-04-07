import { describe, expect, it } from "vitest";

import {
  computeFeishuSignature,
  readFeishuSignatureHeaders,
  timingSafeEqual,
  verifyFeishuRequestSignature,
} from "./feishu-signature";

describe("feishu-signature", () => {
  describe("timingSafeEqual", () => {
    it("should return true for identical strings", () => {
      expect(timingSafeEqual("hello", "hello")).toBe(true);
      expect(timingSafeEqual("a".repeat(64), "a".repeat(64))).toBe(true);
    });

    it("should return false for strings of different lengths", () => {
      expect(timingSafeEqual("hello", "hello world")).toBe(false);
      expect(timingSafeEqual("a".repeat(64), "a".repeat(63))).toBe(false);
    });

    it("should return false for strings with different content", () => {
      expect(timingSafeEqual("hello", "world")).toBe(false);
      expect(timingSafeEqual("12345", "12344")).toBe(false);
      expect(timingSafeEqual(`${"a".repeat(63)}b`, "a".repeat(64))).toBe(false);
    });
  });

  describe("computeFeishuSignature", () => {
    it("should compute signature properly", async () => {
      const ts = "1689650000";
      const nonce = "123456789";
      const encryptKey = "test-secret-key";
      const body = '{"type":"url_verification"}';

      const sig = await computeFeishuSignature(ts, nonce, encryptKey, body);
      // SHA-256 hex is 64 chars
      expect(sig).toHaveLength(64);
    });
  });

  describe("verifyFeishuRequestSignature", () => {
    it("should return true when encryptKey is not provided", async () => {
      const result = await verifyFeishuRequestSignature(
        { nonce: "2", signature: "3", timestamp: "1" },
        "{}"
      );
      expect(result).toBe(true);
    });

    it("should return false when headers are missing", async () => {
      const result = await verifyFeishuRequestSignature(
        { nonce: "2", signature: "3", timestamp: null },
        "{}",
        "key"
      );
      expect(result).toBe(false);
    });

    it("should return true for valid signature", async () => {
      const ts = "1689650000";
      const nonce = "123456789";
      const encryptKey = "test-secret-key";
      const body = '{"type":"url_verification"}';

      const expectedSignature = await computeFeishuSignature(
        ts,
        nonce,
        encryptKey,
        body
      );

      const result = await verifyFeishuRequestSignature(
        { nonce, signature: expectedSignature, timestamp: ts },
        body,
        encryptKey
      );

      expect(result).toBe(true);
    });

    it("should return false for invalid signature", async () => {
      const ts = "1689650000";
      const nonce = "123456789";
      const encryptKey = "test-secret-key";
      const body = '{"type":"url_verification"}';

      const result = await verifyFeishuRequestSignature(
        { nonce, signature: "invalid-sig", timestamp: ts },
        body,
        encryptKey
      );

      expect(result).toBe(false);
    });
  });

  describe("readFeishuSignatureHeaders", () => {
    it("should read headers correctly from Request", () => {
      const req = new Request("http://localhost", {
        headers: {
          "X-Lark-Request-Nonce": "456",
          "X-Lark-Request-Timestamp": "123",
          "X-Lark-Signature": "789",
        },
      });

      const headers = readFeishuSignatureHeaders(req);
      expect(headers).toEqual({
        nonce: "456",
        signature: "789",
        timestamp: "123",
      });
    });
  });
});
