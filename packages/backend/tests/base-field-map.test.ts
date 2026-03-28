import { describe, expect, it } from "vitest";

import type { Doc, Id } from "../convex/_generated/dataModel";
import {
  baseFieldsToProjectPatch,
  projectToBaseFields,
} from "../convex/lib/base-field-map";

const projectId = "p".repeat(32) as Id<"projects">;

const makeProject = (
  overrides: Partial<Doc<"projects">> = {}
): Doc<"projects"> =>
  ({
    _creationTime: 0,
    _id: projectId,
    createdBy: "u1",
    customerName: "Acme",
    departmentId: "d1",
    description: "desc",
    name: "P1",
    ownerId: "o1",
    priority: "medium",
    sourceEntry: "workbench",
    status: "active",
    ...overrides,
  }) as Doc<"projects">;

const makeWorkItem = (status: Doc<"workItems">["status"]): Doc<"workItems"> =>
  ({
    _creationTime: 0,
    _id: "w".repeat(32) as Id<"workItems">,
    description: "",
    priority: "medium",
    projectId,
    status,
    title: "T",
  }) as Doc<"workItems">;

describe("base-field-map", () => {
  it("maps project and work items to Base field payload", () => {
    const project = makeProject();
    const workItems = [makeWorkItem("done"), makeWorkItem("todo")];
    const tracks = [
      {
        _creationTime: 0,
        _id: "t".repeat(32) as Id<"departmentTracks">,
        departmentId: "d1",
        departmentName: "Dept A",
        isRequired: true,
        projectId,
        status: "in_progress" as const,
      },
    ] as Doc<"departmentTracks">[];

    const fields = projectToBaseFields(project, workItems, tracks);
    expect(fields.customer_name).toBe("Acme");
    expect(fields.task_done_count).toBe(1);
    expect(fields.task_total_count).toBe(2);
    expect(fields.progress).toBe("1/2");
    expect(fields.department_count).toBe(1);
  });

  it("uses 0/0 progress when there are no tasks", () => {
    const project = makeProject();
    const fields = projectToBaseFields(project, [], []);
    expect(fields.progress).toBe("0/0");
  });

  it("builds a patch only for Base-owned fields that changed", () => {
    const current = makeProject({ customerName: "Old", name: "N" });
    const patch = baseFieldsToProjectPatch(
      {
        customer_name: "New",
        description: current.description,
        name: "N2",
      },
      { customer_name: "base", description: "base", name: "base" },
      current
    );
    expect(patch.customerName).toBe("New");
    expect(patch.name).toBe("N2");
  });

  it("skips fields owned by non-base sources", () => {
    const current = makeProject({ customerName: "Old" });
    const patch = baseFieldsToProjectPatch(
      { customer_name: "New" },
      { customer_name: "user" },
      current
    );
    expect(patch).toEqual({});
  });
});
