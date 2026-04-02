import type { Id, TableNames } from "../_generated/dataModel";

const MAX_LOG_LENGTH = 120;

export type FeishuWorkItemStatus =
  | "done"
  | "in_progress"
  | "in_review"
  | "todo";

export const sanitizeLogInput = (input: string): string => {
  let sanitized = "";

  for (const char of input) {
    const codePoint = char.codePointAt(0) ?? 0;
    const isControlCharacter =
      codePoint === 127 ||
      codePoint === 10 ||
      codePoint === 13 ||
      codePoint < 32;

    sanitized += isControlCharacter ? " " : char;
  }

  return sanitized
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
    .slice(0, MAX_LOG_LENGTH);
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseJsonRecord = (
  rawBody: string
): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const getRecord = (
  value: Record<string, unknown>,
  key: string
): Record<string, unknown> | null => {
  const candidate = value[key];
  return isRecord(candidate) ? candidate : null;
};

export const getString = (
  value: Record<string, unknown>,
  key: string
): string | null => {
  const candidate = value[key];
  return typeof candidate === "string" ? candidate : null;
};

export const toConvexId = <TableName extends TableNames>(
  value: unknown
): Id<TableName> | null =>
  typeof value === "string" && value.trim().length > 0
    ? (value as Id<TableName>)
    : null;

export const extractEventHeader = (body: Record<string, unknown>) => {
  const header = getRecord(body, "header");

  return {
    eventId: header ? getString(header, "event_id") : null,
    eventType: header ? getString(header, "event_type") : null,
    token: header ? getString(header, "token") : null,
  };
};

export const extractChallenge = (
  body: Record<string, unknown>
): string | null =>
  body.type === "url_verification" && typeof body.challenge === "string"
    ? body.challenge
    : null;

export const mapApprovalStatus = (
  approvalStatus: string | null
): "approved" | "cancelled" | "rejected" | null => {
  switch (approvalStatus) {
    case "APPROVED": {
      return "approved";
    }
    case "CANCELED": {
      return "cancelled";
    }
    case "REJECTED": {
      return "rejected";
    }
    default: {
      return null;
    }
  }
};

export const mapTaskStatus = (
  event: Record<string, unknown>,
  eventType: string | null
): { feishuStatus: string; workItemStatus: FeishuWorkItemStatus } | null => {
  const rawStatus =
    getString(event, "status") ??
    getString(event, "task_status") ??
    (event.completed === true ? "completed" : null) ??
    (eventType === "task.completed" ? "completed" : null);

  if (!rawStatus) {
    return null;
  }

  const feishuStatus = rawStatus.toLowerCase();

  switch (feishuStatus) {
    case "created":
    case "todo": {
      return { feishuStatus, workItemStatus: "todo" };
    }
    case "started":
    case "in_progress":
    case "processing": {
      return { feishuStatus, workItemStatus: "in_progress" };
    }
    case "pending_review":
    case "reviewing": {
      return { feishuStatus, workItemStatus: "in_review" };
    }
    case "completed":
    case "done": {
      return { feishuStatus, workItemStatus: "done" };
    }
    default: {
      return null;
    }
  }
};

export const extractProjectIdFromUrl = (url: string): string | null => {
  const match = url.match(/\/projects\/([a-zA-Z0-9_]+)/);
  return match?.[1] ?? null;
};

export const isFreshFeishuTimestamp = (
  timestampSeconds: string,
  nowMs: number,
  maxSkewMs: number
): boolean => {
  const timestampMs = Number(timestampSeconds) * 1000;
  return (
    Number.isFinite(timestampMs) && Math.abs(nowMs - timestampMs) <= maxSkewMs
  );
};

export const buildFeishuSignaturePayload = (
  timestampSeconds: string,
  nonce: string,
  rawBody: string
): string => `${timestampSeconds}${nonce}${rawBody}`;

const encodeBase64 = (bytes: Uint8Array): string => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary);
};

export const createFeishuSignature = async (
  secret: string,
  timestampSeconds: string,
  nonce: string,
  rawBody: string
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(
      buildFeishuSignaturePayload(timestampSeconds, nonce, rawBody)
    )
  );

  return encodeBase64(new Uint8Array(signature));
};
