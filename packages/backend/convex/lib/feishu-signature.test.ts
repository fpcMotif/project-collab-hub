import { test, expect } from "bun:test";

import {
  computeFeishuSignature,
  verifyFeishuRequestSignature,
  readFeishuSignatureHeaders,
} from "./feishu-signature";

test("computeFeishuSignature creates consistent SHA-256 hex string", async () => {
  const timestamp = "1710000000";
  const nonce = "test-nonce";
  const encryptKey = "test-encrypt-key";
  const bodyText = '{"test":"value"}';

  const hash1 = await computeFeishuSignature(
    timestamp,
    nonce,
    encryptKey,
    bodyText
  );
  const hash2 = await computeFeishuSignature(
    timestamp,
    nonce,
    encryptKey,
    bodyText
  );

  expect(hash1).toEqual(hash2);
  // SHA-256 is 32 bytes = 64 hex chars
  expect(hash1.length).toBe(64);
});

test("verifyFeishuRequestSignature returns true with correct signature", async () => {
  const timestamp = "1710000000";
  const nonce = "test-nonce";
  const encryptKey = "test-encrypt-key";
  const bodyText = '{"test":"value"}';

  const signature = await computeFeishuSignature(
    timestamp,
    nonce,
    encryptKey,
    bodyText
  );

  const headers = {
    nonce,
    signature,
    timestamp,
  };

  const isValid = await verifyFeishuRequestSignature(
    headers,
    bodyText,
    encryptKey
  );
  expect(isValid).toBe(true);
});

test("verifyFeishuRequestSignature returns false with incorrect signature", async () => {
  const timestamp = "1710000000";
  const nonce = "test-nonce";
  const encryptKey = "test-encrypt-key";
  const bodyText = '{"test":"value"}';

  const headers = {
    nonce,
    signature: "invalid-signature-here".padEnd(64, "0"),
    timestamp,
  };

  const isValid = await verifyFeishuRequestSignature(
    headers,
    bodyText,
    encryptKey
  );
  expect(isValid).toBe(false);
});

test("verifyFeishuRequestSignature returns false when signature lengths differ", async () => {
  const timestamp = "1710000000";
  const nonce = "test-nonce";
  const encryptKey = "test-encrypt-key";
  const bodyText = '{"test":"value"}';

  const headers = {
    nonce,
    signature: "short-sig",
    timestamp,
  };

  const isValid = await verifyFeishuRequestSignature(
    headers,
    bodyText,
    encryptKey
  );
  expect(isValid).toBe(false);
});

test("readFeishuSignatureHeaders reads headers properly", () => {
  const req = new Request("http://localhost", {
    headers: {
      "X-Lark-Request-Nonce": "nonce-123",
      "X-Lark-Request-Timestamp": "time-123",
      "X-Lark-Signature": "sig-123",
    },
  });

  const headers = readFeishuSignatureHeaders(req);
  expect(headers.nonce).toBe("nonce-123");
  expect(headers.signature).toBe("sig-123");
  expect(headers.timestamp).toBe("time-123");
});
