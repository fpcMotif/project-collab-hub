import { DEFAULT_TEMPLATE_CONFIG } from "@collab-hub/shared";

import type { ProjectTemplateOption } from "./types";

export const MOCK_PROJECT_TEMPLATES: ProjectTemplateOption[] = [
  {
    approvalGates: DEFAULT_TEMPLATE_CONFIG.approvalGates.map((gate) => ({
      ...gate,
    })),
    defaultPriority: DEFAULT_TEMPLATE_CONFIG.defaultPriority,
    departments: DEFAULT_TEMPLATE_CONFIG.departments.map((department) => ({
      ...department,
    })),
    description: DEFAULT_TEMPLATE_CONFIG.description,
    id: "tpl-default-cross-functional",
    name: DEFAULT_TEMPLATE_CONFIG.name,
    version: DEFAULT_TEMPLATE_CONFIG.version,
  },
  {
    approvalGates: [
      {
        triggerStage: "ready",
        approvalCode: "APPROVAL_PROCUREMENT_BUDGET",
        title: "采购预算审批",
        isRequired: true,
      },
      {
        triggerStage: "delivering",
        approvalCode: "APPROVAL_DELIVERY_ACCEPTANCE",
        title: "交付验收审批",
        isRequired: true,
      },
    ],
    defaultPriority: "high",
    departments: [
      {
        departmentId: "dept-sales",
        departmentName: "商务部",
        isRequired: true,
      },
      { departmentId: "dept-tech", departmentName: "技术部", isRequired: true },
      {
        departmentId: "dept-procurement",
        departmentName: "采购部",
        isRequired: true,
      },
      {
        departmentId: "dept-logistics",
        departmentName: "物流部",
        isRequired: true,
      },
    ],
    description: "适用于采购、技术、物流并行协同的客户交付项目。",
    id: "tpl-supply-chain-delivery",
    name: "供应链交付",
    version: 3,
  },
  {
    approvalGates: [
      {
        triggerStage: "ready",
        approvalCode: "APPROVAL_PROJECT_START",
        title: "项目启动审批",
        isRequired: true,
      },
    ],
    defaultPriority: "medium",
    departments: [
      {
        departmentId: "dept-sales",
        departmentName: "商务部",
        isRequired: true,
      },
      { departmentId: "dept-tech", departmentName: "技术部", isRequired: true },
      {
        departmentId: "dept-design",
        departmentName: "设计部",
        isRequired: false,
      },
      { departmentId: "dept-ops", departmentName: "运营部", isRequired: true },
    ],
    description: "适用于产品实施、培训与上线推广场景。",
    id: "tpl-saas-implementation",
    name: "SaaS 实施",
    version: 2,
  },
];
