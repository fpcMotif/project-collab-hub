import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SLA_RISK_STYLES } from "../constants";
import type { SlaRisk } from "../types";
import { SlaRiskIndicator } from "./sla-risk-indicator";

describe("SlaRiskIndicator", () => {
  it("renders on_time risk correctly", () => {
    const risk: SlaRisk = "on_time";
    render(<SlaRiskIndicator risk={risk} />);

    // Check if label is rendered
    expect(screen.getByText(SLA_RISK_STYLES[risk].label)).toBeInTheDocument();

    // Check if main text color is applied
    const span = screen.getByText(SLA_RISK_STYLES[risk].label);
    expect(span).toHaveClass(SLA_RISK_STYLES[risk].text);

    // Check if dot color is applied
    const dot = span.querySelector("span[aria-hidden='true']");
    expect(dot).toHaveClass(SLA_RISK_STYLES[risk].dot);
  });

  it("renders at_risk risk correctly", () => {
    const risk: SlaRisk = "at_risk";
    render(<SlaRiskIndicator risk={risk} />);

    expect(screen.getByText(SLA_RISK_STYLES[risk].label)).toBeInTheDocument();

    const span = screen.getByText(SLA_RISK_STYLES[risk].label);
    expect(span).toHaveClass(SLA_RISK_STYLES[risk].text);

    const dot = span.querySelector("span[aria-hidden='true']");
    expect(dot).toHaveClass(SLA_RISK_STYLES[risk].dot);
  });

  it("renders overdue risk correctly", () => {
    const risk: SlaRisk = "overdue";
    render(<SlaRiskIndicator risk={risk} />);

    expect(screen.getByText(SLA_RISK_STYLES[risk].label)).toBeInTheDocument();

    const span = screen.getByText(SLA_RISK_STYLES[risk].label);
    expect(span).toHaveClass(SLA_RISK_STYLES[risk].text);

    const dot = span.querySelector("span[aria-hidden='true']");
    expect(dot).toHaveClass(SLA_RISK_STYLES[risk].dot);
  });
});
