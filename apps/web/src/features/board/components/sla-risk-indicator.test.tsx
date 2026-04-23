// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { SLA_RISK_STYLES } from "../constants";
import type { SlaRisk } from "../types";
import { SlaRiskIndicator } from "./sla-risk-indicator";

describe("SlaRiskIndicator", () => {
  it("renders on_time risk correctly", () => {
    const risk: SlaRisk = "on_time";
    const style = SLA_RISK_STYLES[risk];

    render(<SlaRiskIndicator risk={risk} />);

    const element = screen.getByText(style.label);
    expect(element).toBeInTheDocument();
    expect(element.className).toContain(style.text);

    const dotElement = element.querySelector("span[aria-hidden='true']");
    expect(dotElement).toBeInTheDocument();
    expect(dotElement?.className).toContain(style.dot);
  });

  it("renders at_risk risk correctly", () => {
    const risk: SlaRisk = "at_risk";
    const style = SLA_RISK_STYLES[risk];

    render(<SlaRiskIndicator risk={risk} />);

    const element = screen.getByText(style.label);
    expect(element).toBeInTheDocument();
    expect(element.className).toContain(style.text);

    const dotElement = element.querySelector("span[aria-hidden='true']");
    expect(dotElement).toBeInTheDocument();
    expect(dotElement?.className).toContain(style.dot);
  });

  it("renders overdue risk correctly", () => {
    const risk: SlaRisk = "overdue";
    const style = SLA_RISK_STYLES[risk];

    render(<SlaRiskIndicator risk={risk} />);

    const element = screen.getByText(style.label);
    expect(element).toBeInTheDocument();
    expect(element.className).toContain(style.text);

    const dotElement = element.querySelector("span[aria-hidden='true']");
    expect(dotElement).toBeInTheDocument();
    expect(dotElement?.className).toContain(style.dot);
  });

  it("handles invalid risk gracefully", () => {
    const { container } = render(
      <SlaRiskIndicator risk={"invalid" as SlaRisk} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("handles undefined risk gracefully", () => {
    const { container } = render(
      <SlaRiskIndicator risk={undefined as unknown as SlaRisk} />
    );
    expect(container.firstChild).toBeNull();
  });
});
