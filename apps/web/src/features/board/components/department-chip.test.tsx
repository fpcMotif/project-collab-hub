import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { DepartmentChip } from "./department-chip";
import { DEPT_STATUS_LABELS, DEPT_STATUS_STYLES } from "../constants";
import type { DepartmentTrackSummary } from "../types";

describe("DepartmentChip", () => {
  it("renders correctly with standard status and no blockReason", () => {
    const track: DepartmentTrackSummary = {
      departmentName: "Engineering",
      status: "in_progress",
    };

    render(<DepartmentChip track={track} />);

    // Check if the department name is rendered
    const element = screen.getByText("Engineering");
    expect(element).toBeDefined();

    // Check if the title is correctly formatted
    const expectedLabel = DEPT_STATUS_LABELS["in_progress"];
    const expectedTitle = `Engineering: ${expectedLabel}`;
    expect(element.getAttribute("title")).toBe(expectedTitle);
  });

  it("renders correctly when status includes a blockReason", () => {
    const track: DepartmentTrackSummary = {
      departmentName: "Design",
      status: "blocked",
      blockReason: "Waiting for assets",
    };

    render(<DepartmentChip track={track} />);

    const element = screen.getByText("Design");
    expect(element).toBeDefined();

    const expectedLabel = DEPT_STATUS_LABELS["blocked"];
    const expectedTitle = `Design: ${expectedLabel} · Waiting for assets`;
    expect(element.getAttribute("title")).toBe(expectedTitle);
  });

  it("applies correct style classes based on status", () => {
    const track: DepartmentTrackSummary = {
      departmentName: "QA",
      status: "done",
    };

    render(<DepartmentChip track={track} />);

    const element = screen.getByText("QA");

    // Check baseline class
    expect(element.className).toContain("inline-flex");
    expect(element.className).toContain("items-center");

    // Check dynamic classes from DEPT_STATUS_STYLES
    const expectedStyles = DEPT_STATUS_STYLES["done"];
    expect(element.className).toContain(expectedStyles.bg);
    expect(element.className).toContain(expectedStyles.text);
  });

  it("handles empty blockReason safely", () => {
    const track: DepartmentTrackSummary = {
      departmentName: "Marketing",
      status: "not_started",
      blockReason: "", // Empty string instead of undefined
    };

    render(<DepartmentChip track={track} />);

    const element = screen.getByText("Marketing");
    const expectedLabel = DEPT_STATUS_LABELS["not_started"];
    const expectedTitle = `Marketing: ${expectedLabel}`; // Should fall back to no block reason formatting

    expect(element.getAttribute("title")).toBe(expectedTitle);
  });
});
