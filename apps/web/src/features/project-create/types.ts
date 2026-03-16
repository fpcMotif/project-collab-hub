import type { Priority } from "@/features/board/types";

export interface ProjectTemplateDepartmentOption {
  departmentId: string;
  departmentName: string;
  isRequired: boolean;
  defaultOwnerId?: string;
}

export interface ProjectTemplateApprovalOption {
  triggerStage: string;
  approvalCode: string;
  title: string;
  isRequired: boolean;
}

export interface ProjectTemplateOption {
  id: string;
  name: string;
  description: string;
  version: number;
  defaultPriority: Priority;
  departments: ProjectTemplateDepartmentOption[];
  approvalGates: ProjectTemplateApprovalOption[];
}

export interface ConvexProjectTemplateDoc extends Omit<
  ProjectTemplateOption,
  "id"
> {
  _id: string;
}

export interface ProjectCreateFormValues {
  templateId: string;
  name: string;
  description: string;
  customerName: string;
  ownerId: string;
  departmentId: string;
  priority: Priority;
  slaDeadline: string;
}
