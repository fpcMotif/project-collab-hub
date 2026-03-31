import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PRIORITY_LABELS, PRIORITY_STYLES } from "../constants";
import type { Priority } from "../types";
import { PriorityBadge } from "./priority-badge";

describe("PriorityBadge", () => {
  const priorities: Priority[] = ["low", "medium", "high", "urgent"];

  it.each(priorities)(
    "renders correct label and styles for priority %s",
    (priority) => {
      render(<PriorityBadge priority={priority} />);

      const label = PRIORITY_LABELS[priority];
      const badgeElement = screen.getByText(label);

      expect(badgeElement).toBeInTheDocument();

      // Test base classes
      expect(badgeElement).toHaveClass("inline-flex");
      expect(badgeElement).toHaveClass("items-center");
      expect(badgeElement).toHaveClass("rounded");
      expect(badgeElement).toHaveClass("px-1.5");
      expect(badgeElement).toHaveClass("py-0.5");
      expect(badgeElement).toHaveClass("text-xs");
      expect(badgeElement).toHaveClass("font-semibold");

      // Test priority specific classes
      const expectedClasses = PRIORITY_STYLES[priority].split(" ");
      for (const className of expectedClasses) {
        expect(badgeElement).toHaveClass(className);
      }
    }
  );

  // Test edge case (e.g. invalid priority)
  // Typescript prevents invalid string via type checking but runtime might receive incorrect data.
  it("renders without crashing for undefined priority", () => {
    // @ts-expect-error Testing undefined runtime case
    render(<PriorityBadge priority={undefined} />);
    // The inner text will be undefined as PRIORITY_LABELS[undefined] -> undefined.
    // We expect the element to render still, without label text, but with the base classes.
    const { container } = render(
      // @ts-expect-error Testing undefined runtime case
      <PriorityBadge priority={undefined} />
    );
    const span = container.querySelector("span");
    expect(span).toBeInTheDocument();
    expect(span).toHaveClass("inline-flex");
  });
});
