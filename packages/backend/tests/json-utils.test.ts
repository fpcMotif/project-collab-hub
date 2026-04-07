import { describe, expect, it } from "vitest";

import { parseJsonSafely } from "../convex/lib/json-utils";

describe("parseJsonSafely", () => {
  it("should parse valid JSON objects successfully", () => {
    const result = parseJsonSafely('{"key": "value"}');
    expect(result).toEqual({ key: "value" });
  });

  it("should return null for invalid JSON strings", () => {
    const result = parseJsonSafely('{key: "value"}');
    expect(result).toBeNull();
  });

  it("should return null for empty strings", () => {
    const result = parseJsonSafely("");
    expect(result).toBeNull();
  });

  it("should return null for arrays", () => {
    const result = parseJsonSafely('[{"key": "value"}]');
    expect(result).toBeNull();
  });

  it("should return null for primitives", () => {
    expect(parseJsonSafely('"string"')).toBeNull();
    expect(parseJsonSafely("123")).toBeNull();
    expect(parseJsonSafely("true")).toBeNull();
    expect(parseJsonSafely("null")).toBeNull();
  });
});
