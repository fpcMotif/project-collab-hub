import { describe, expect, it } from "vitest";

import { buildNotificationCard } from "../convex/lib/notification-card";

describe("buildNotificationCard", () => {
  it("builds an approval_result card with green header when approved", () => {
    const card = buildNotificationCard("approval_result", {
      projectName: "Alpha",
      status: "approved",
    });
    expect(card.header.template).toBe("green");
    expect(JSON.stringify(card.elements)).toContain("Alpha");
    expect(JSON.stringify(card.elements)).toContain("approved");
  });

  it("builds a stage_change card with from/to stages", () => {
    const card = buildNotificationCard("stage_change", {
      fromStage: "A",
      projectName: "Beta",
      targetStage: "B",
    });
    expect(JSON.stringify(card.elements)).toContain("A → B");
  });

  it("falls back to a generic card for unknown message types", () => {
    const card = buildNotificationCard("custom", {
      foo: "bar",
      projectName: "Gamma",
    });
    expect(card.header.template).toBe("grey");
    expect(JSON.stringify(card.elements)).toContain("bar");
  });
});
