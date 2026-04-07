import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SLA_RISK_STYLES } from "../constants";
import { SlaRiskIndicator } from "./sla-risk-indicator";

describe("SlaRiskIndicator", () => {
  it("renders on_time state correctly", () => {
    const { container } = render(<SlaRiskIndicator risk="on_time" />);

    // Check text label
    const style = SLA_RISK_STYLES["on_time"];
    expect(screen.getByText(style.label)).toBeInTheDocument();

    // Check container text class
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass(style.text);

    // Check dot class
    // The dot is an empty span with aria-hidden="true"
    // Getting it by checking the first element child of the wrapper (which is the dot)
    const dot = wrapper.firstChild as HTMLElement;
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(dot).toHaveClass(style.dot);
  });

  it("renders at_risk state correctly", () => {
    const { container } = render(<SlaRiskIndicator risk="at_risk" />);

    const style = SLA_RISK_STYLES["at_risk"];
    expect(screen.getByText(style.label)).toBeInTheDocument();

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass(style.text);

    const dot = wrapper.firstChild as HTMLElement;
    expect(dot).toHaveClass(style.dot);
  });

  it("renders overdue state correctly", () => {
    const { container } = render(<SlaRiskIndicator risk="overdue" />);

    const style = SLA_RISK_STYLES["overdue"];
    expect(screen.getByText(style.label)).toBeInTheDocument();

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass(style.text);

    const dot = wrapper.firstChild as HTMLElement;
    expect(dot).toHaveClass(style.dot);
  });
});
