/**
 * Feishu/Lark event signature (Encrypt Key + HMAC-SHA256 style digest used by open platform callbacks).
 * Kept pure for unit tests; http routes pass env-derived key.
 */

export const computeFeishuSignature = async (
  timestamp: string,
  nonce: string,
  encryptKey: string,
  bodyText: string
): Promise<string> => {
  const content = timestamp + nonce + encryptKey + bodyText;
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = [...new Uint8Array(hashBuffer)];

  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

export interface FeishuSignatureHeaders {
  readonly signature: string | null;
  readonly timestamp: string | null;
  readonly nonce: string | null;
}

export const readFeishuSignatureHeaders = (
  request: Request
): FeishuSignatureHeaders => ({
  nonce: request.headers.get("X-Lark-Request-Nonce"),
  signature: request.headers.get("X-Lark-Signature"),
  timestamp: request.headers.get("X-Lark-Request-Timestamp"),
});

export const verifyFeishuRequestSignature = async (
  headers: FeishuSignatureHeaders,
  bodyText: string,
  encryptKey: string | undefined
): Promise<boolean> => {
  if (!encryptKey) {
    return true;
  }

  if (!headers.signature || !headers.timestamp || !headers.nonce) {
    return false;
  }

  const expected = await computeFeishuSignature(
    headers.timestamp,
    headers.nonce,
    encryptKey,
    bodyText
  );

  if (headers.signature.length !== expected.length) {
    return false;
  }

  const encoder = new TextEncoder();
  const signatureBuffer = encoder.encode(headers.signature);
  const expectedBuffer = encoder.encode(expected);

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  if (crypto.subtle.timingSafeEqual === undefined) {
    // Fallback for environments lacking timingSafeEqual (e.g. some bun/vitest tests)
    let result = 0;
    for (let i = 0; i < signatureBuffer.length; i += 1) {
      // eslint-disable-next-line no-bitwise
      result |= signatureBuffer[i] ^ expectedBuffer[i];
    }
    return result === 0;
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  return crypto.subtle.timingSafeEqual(signatureBuffer, expectedBuffer);
};
