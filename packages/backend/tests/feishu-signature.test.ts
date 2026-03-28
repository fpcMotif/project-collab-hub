import { describe, expect, it } from "vitest";

import {
  computeFeishuSignature,
  readFeishuSignatureHeaders,
  verifyFeishuRequestSignature,
} from "../convex/lib/feishu-signature";

describe("feishu-signature", () => {
  it("computes a stable SHA-256 hex digest for known inputs", async () => {
    const digest = await computeFeishuSignature(
      "1700000000",
      "nonce-1",
      "encrypt-key",
      '{"hello":"world"}'
    );
    expect(digest).toHaveLength(64);
    expect(digest).toMatch(/^[0-9a-f]+$/);
  });

  it("reads Feishu signature headers from a Request", () => {
    const request = new Request("https://example.com/hook", {
      headers: {
        "X-Lark-Request-Nonce": "n1",
        "X-Lark-Request-Timestamp": "t1",
        "X-Lark-Signature": "sig",
      },
    });
    expect(readFeishuSignatureHeaders(request)).toEqual({
      nonce: "n1",
      signature: "sig",
      timestamp: "t1",
    });
  });

  it("returns true when encrypt key is missing (dev bypass)", async () => {
    const ok = await verifyFeishuRequestSignature(
      { nonce: "a", signature: "b", timestamp: "c" },
      "{}"
    );
    expect(ok).toBe(true);
  });

  it("returns false when encrypt key is set but headers are incomplete", async () => {
    const ok = await verifyFeishuRequestSignature(
      { nonce: null, signature: "b", timestamp: "c" },
      "{}",
      "key"
    );
    expect(ok).toBe(false);
  });

  it("returns true when computed signature matches header", async () => {
    const body = '{"type":"test"}';
    const ts = "1";
    const nonce = "2";
    const key = "k";
    const expected = await computeFeishuSignature(ts, nonce, key, body);
    const ok = await verifyFeishuRequestSignature(
      { nonce, signature: expected, timestamp: ts },
      body,
      key
    );
    expect(ok).toBe(true);
  });

  it("returns false on signature mismatch", async () => {
    const ok = await verifyFeishuRequestSignature(
      { nonce: "n", signature: "wrong", timestamp: "t" },
      "{}",
      "encrypt"
    );
    expect(ok).toBe(false);
  });
});
