import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");

describe("projectTemplates", () => {
  it("list query works", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("projectTemplates", {
        approvalGates: [],
        chatPolicy: {
          addBotAsManager: true,
          autoCreateChat: true,
          pinProjectCard: true,
        },
        createdBy: "user_1",
        defaultPriority: "medium",
        departments: [],
        description: "Active Template",
        isActive: true,
        name: "Active Template",
        notificationRules: [],
        updatedAt: Date.now(),
        version: 1,
      });

      await ctx.db.insert("projectTemplates", {
        approvalGates: [],
        chatPolicy: {
          addBotAsManager: true,
          autoCreateChat: true,
          pinProjectCard: true,
        },
        createdBy: "user_1",
        defaultPriority: "medium",
        departments: [],
        description: "Inactive Template",
        name: "Inactive Template",
        notificationRules: [],
        updatedAt: Date.now(),
        version: 1,
        version: 1,
      });
    });

    const allTemplates = await t.query(api.projectTemplates.list, {
      activeOnly: false,
    });
    expect(allTemplates).toHaveLength(2);

    const activeTemplates = await t.query(api.projectTemplates.list, {
      activeOnly: true,
    });
    expect(activeTemplates).toHaveLength(1);
    expect(activeTemplates[0].name).toBe("Active Template");
  });

  it("getById query works", async () => {
    const t = convexTest(schema, modules);
    let templateId: any;

    await t.run(async (ctx) => {
      templateId = await ctx.db.insert("projectTemplates", {
        approvalGates: [],
        chatPolicy: {
          addBotAsManager: true,
          autoCreateChat: true,
          pinProjectCard: true,
        },
        createdBy: "user_1",
        defaultPriority: "medium",
        departments: [],
        description: "Test Template",
        isActive: true,
        name: "Test Template",
        notificationRules: [],
        updatedAt: Date.now(),
        version: 1,
      });
    });

    const template = await t.query(api.projectTemplates.getById, {
      id: templateId,
    });
    expect(template).not.toBeNull();
    expect(template?.name).toBe("Test Template");

    // Test non-existent ID
    // We need a valid-format ID but non-existent.
    // convex-test might complain if it's just a random string.
    // Memory says: To simulate a 'not found' scenario requiring a structurally valid ID,
    // use t.run to insert a temporary document and immediately delete it.
    let nonExistentId: any;
    await t.run(async (ctx) => {
      const tempId = await ctx.db.insert("projectTemplates", {
        approvalGates: [],
        chatPolicy: {
          addBotAsManager: true,
          autoCreateChat: true,
          pinProjectCard: true,
        },
        createdBy: "user_1",
        defaultPriority: "medium",
        departments: [],
        description: "temp",
        isActive: true,
        name: "temp",
        notificationRules: [],
        updatedAt: Date.now(),
        version: 1,
      });
      await ctx.db.delete(tempId);
      nonExistentId = tempId;
    });

    const notFound = await t.query(api.projectTemplates.getById, {
      id: nonExistentId,
    });
    expect(notFound).toBeNull();
  });

  it("create mutation works", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "user_123" });

    const args = {
      approvalGates: [
        {
          approvalCode: "CODE1",
          isRequired: true,
          title: "Gate 1",
          triggerStage: "assessment",
        },
      ],
      chatPolicy: {
        addBotAsManager: true,
        autoCreateChat: true,
        chatNameTemplate: "Project {{name}}",
        pinProjectCard: true,
      },
      defaultPriority: "high" as const,
      departments: [
        {
          departmentId: "dept_1",
          departmentName: "Engineering",
          isRequired: true,
        },
      ],
      description: "A new template description",
      name: "New Project Template",
      notificationRules: [],
    };

    const templateId = await asUser.mutation(api.projectTemplates.create, args);
    expect(templateId).toBeDefined();

    await t.run(async (ctx) => {
      const template = await ctx.db.get(templateId);
      expect(template).toMatchObject({
        ...args,
        createdBy: "user_123",
        isActive: true,
        version: 1,
      });

      const auditEvent = await ctx.db
        .query("auditEvents")
        .filter((q) => q.eq(q.field("objectId"), templateId))
        .unique();

      expect(auditEvent).not.toBeNull();
      expect(auditEvent?.action).toBe("template.created");
      expect(auditEvent?.actorId).toBe("user_123");
    });
  });

  it("create mutation throws if not authenticated", async () => {
    const t = convexTest(schema, modules);

    const args = {
      approvalGates: [],
      chatPolicy: {
        addBotAsManager: true,
        autoCreateChat: true,
        pinProjectCard: true,
      },
      defaultPriority: "medium" as const,
      departments: [],
      description: "desc",
      name: "name",
      notificationRules: [],
    };

    await expect(t.mutation(api.projectTemplates.create, args)).rejects.toThrow(
      "Authentication required"
    );
  });

  it("createNewVersion mutation works", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "user_123" });
    let sourceTemplateId: any;

    await t.run(async (ctx) => {
      sourceTemplateId = await ctx.db.insert("projectTemplates", {
        approvalGates: [],
        chatPolicy: {
          addBotAsManager: true,
          autoCreateChat: true,
          pinProjectCard: true,
        },
        createdBy: "user_1",
        defaultPriority: "medium",
        departments: [],
        description: "Initial Template",
        isActive: true,
        name: "Initial Template",
        notificationRules: [],
        updatedAt: Date.now(),
        version: 1,
      });
    });

    const newTemplateId = await asUser.mutation(
      api.projectTemplates.createNewVersion,
      {
        sourceTemplateId,
      }
    );

    await t.run(async (ctx) => {
      const oldTemplate = await ctx.db.get(sourceTemplateId);
      expect(oldTemplate?.isActive).toBe(false);

      const newTemplate = await ctx.db.get(newTemplateId);
      expect(newTemplate?.isActive).toBe(true);
      expect(newTemplate?.version).toBe(2);
      expect(newTemplate?.name).toBe("Initial Template");

      const auditEvent = await ctx.db
        .query("auditEvents")
        .filter((q) => q.eq(q.field("objectId"), newTemplateId))
        .unique();

      expect(auditEvent?.action).toBe("template.versioned");
    });
  });

  it("createNewVersion throws if template not found", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "user_123" });

    let nonExistentId: any;
    await t.run(async (ctx) => {
      const tempId = await ctx.db.insert("projectTemplates", {
        approvalGates: [],
        chatPolicy: {
          addBotAsManager: true,
          autoCreateChat: true,
          pinProjectCard: true,
        },
        createdBy: "user_1",
        defaultPriority: "medium",
        departments: [],
        description: "temp",
        isActive: true,
        name: "temp",
        notificationRules: [],
        updatedAt: Date.now(),
        version: 1,
      });
      await ctx.db.delete(tempId);
      nonExistentId = tempId;
    });

    await expect(
      asUser.mutation(api.projectTemplates.createNewVersion, {
        sourceTemplateId: nonExistentId,
      })
    ).rejects.toThrow(`Template ${nonExistentId} not found`);
  });

  it("createNewVersion throws if not authenticated", async () => {
    const t = convexTest(schema, modules);
    let dummyId: string = "";
    await t.run(async (ctx) => {
      dummyId = await ctx.db.insert("projectTemplates", {
        approvalGates: [],
        chatPolicy: {
          addBotAsManager: false,
          autoCreateChat: false,
          pinProjectCard: false,
        },
        createdBy: "system",
        defaultPriority: "medium",
        departments: [],
        description: "",
        isActive: true,
        name: "dummy",
        notificationRules: [],
        updatedAt: Date.now(),
        version: 1,
      });
    });

    // Missing identity
    await expect(
      t.mutation(api.projectTemplates.createNewVersion, {
        sourceTemplateId: dummyId as any,
      })
    ).rejects.toThrow("Authentication required");
  });
});
