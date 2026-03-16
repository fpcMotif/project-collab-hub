import { describe, expect, test } from "bun:test";
import { canAdvanceStage } from "../board";

describe("canAdvanceStage", () => {
  test("allows valid transition with no blocking tracks", () => {
    const result = canAdvanceStage("new", "assessment", ["not_started", "in_progress", "done"]);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  test("blocks invalid transition", () => {
    const result = canAdvanceStage("new", "ready", []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Transition from "new" to "ready" is not permitted');
  });

  test("blocks transition if any track is 'blocked'", () => {
    const result = canAdvanceStage("assessment", "solution", ["not_started", "blocked"]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("1 required department(s) are blocked or waiting approval");
  });

  test("blocks transition if any track is 'waiting_approval'", () => {
    const result = canAdvanceStage("assessment", "solution", ["waiting_approval", "in_progress"]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("1 required department(s) are blocked or waiting approval");
  });

  test("blocks transition if multiple tracks are blocking", () => {
    const result = canAdvanceStage("solution", "ready", ["blocked", "waiting_approval", "not_started"]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("2 required department(s) are blocked or waiting approval");
  });

  test("blocks if current status is invalid", () => {
    const result = canAdvanceStage("invalid_status", "assessment", []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Transition from "invalid_status" to "assessment" is not permitted');
  });

  test("blocks if transition from current status is empty (e.g., done)", () => {
    const result = canAdvanceStage("done", "assessment", []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Transition from "done" to "assessment" is not permitted');
  });

  test("allows transition from cancelled to nowhere basically, but test transition logic", () => {
    const result = canAdvanceStage("cancelled", "new", []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Transition from "cancelled" to "new" is not permitted');
  });
});
