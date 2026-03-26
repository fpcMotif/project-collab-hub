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

  it("builds a workflow_approval card with interactive buttons", () => {
    const card = buildNotificationCard("workflow_approval", {
      applicantName: "John Doe",
      approvalTitle: "Review Solution",
      gateId: "gate1",
      instanceCode: "inst1",
      projectName: "Delta",
      submissionTime: "2026-03-26",
    });
    expect(card.header.template).toBe("indigo");
    expect(JSON.stringify(card.header.title)).toContain("Review Solution");
    expect(JSON.stringify(card.elements)).toContain("John Doe");
    expect(JSON.stringify(card.elements)).toContain("2026-03-26");

    const actionElement = card.elements.find((e) => e.tag === "action");
    expect(actionElement?.actions).toHaveLength(2);
    expect(actionElement?.actions?.[0].type).toBe("primary");
    expect(actionElement?.actions?.[1].type).toBe("danger");
    expect(actionElement?.actions?.[0].value.action).toBe("approve");
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
