"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useConvexEnabled } from "@/providers/ConvexClientProvider";
import { convexFunctionRefs } from "@/lib/convex-function-refs";
import type { BoardProjectRecord } from "@/features/board/types";
import { useMockProjectStore } from "@/features/board/hooks/useMockProjectStore";
import { MOCK_PROJECT_TEMPLATES } from "../mock-templates";
import { ProjectCreateForm } from "./ProjectCreateForm";
import type {
  ConvexProjectTemplateDoc,
  ProjectCreateFormValues,
  ProjectTemplateOption,
} from "../types";

const CREATE_ACTOR_ID = "web_app.user";

function toProjectTemplateOption(template: ConvexProjectTemplateDoc): ProjectTemplateOption {
  return {
    id: template._id,
    name: template.name,
    description: template.description,
    version: template.version,
    defaultPriority: template.defaultPriority,
    departments: template.departments,
    approvalGates: template.approvalGates,
  };
}

function createProjectId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `P-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }

  return `P-${Date.now().toString(36).toUpperCase()}`;
}

function createMockProjectRecord(
  values: ProjectCreateFormValues,
  template: ProjectTemplateOption,
): BoardProjectRecord {
  return {
    id: createProjectId(),
    name: values.name.trim(),
    customerName: values.customerName.trim() || "未填写客户",
    ownerName: values.ownerId.trim(),
    status: "new",
    priority: values.priority,
    slaRisk: "on_time",
    templateType: template.name,
    departmentTracks: template.departments.map((department) => ({
      departmentName: department.departmentName,
      status: department.isRequired ? "not_started" : "not_required",
    })),
    pendingApprovalCount: 0,
    overdueTaskCount: 0,
  };
}

export function ProjectCreateScreen() {
  const convexEnabled = useConvexEnabled();

  if (convexEnabled) {
    return <ConnectedProjectCreateScreen />;
  }

  return <MockProjectCreateScreen />;
}

function ConnectedProjectCreateScreen() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const templatesQuery = useQuery(convexFunctionRefs.listProjectTemplates, { activeOnly: true });
  const createProjectFromTemplate = useMutation(convexFunctionRefs.createProjectFromTemplate);

  const templates = useMemo(
    () => (templatesQuery ?? []).map(toProjectTemplateOption),
    [templatesQuery],
  );

  if (templatesQuery === undefined) {
    return <ProjectCreateLoading />;
  }

  return (
    <ProjectCreateForm
      templates={templates}
      isSubmitting={isSubmitting}
      onSubmit={async (values) => {
        setIsSubmitting(true);
        try {
          const result = await createProjectFromTemplate({
            templateId: values.templateId,
            name: values.name.trim(),
            description: values.description.trim(),
            ownerId: values.ownerId.trim(),
            departmentId: values.departmentId,
            customerName: values.customerName.trim() || undefined,
            priority: values.priority,
            slaDeadline: values.slaDeadline
              ? new Date(`${values.slaDeadline}T09:00:00`).getTime()
              : undefined,
            createdBy: CREATE_ACTOR_ID,
            sourceEntry: "workbench",
          });

          router.push(`/projects/${result.projectId}`);
          return { ok: true, projectId: result.projectId };
        } catch (error) {
          return {
            ok: false,
            message: error instanceof Error ? error.message : String(error),
          };
        } finally {
          setIsSubmitting(false);
        }
      }}
    />
  );
}

function MockProjectCreateScreen() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addProject } = useMockProjectStore();

  return (
    <ProjectCreateForm
      templates={MOCK_PROJECT_TEMPLATES}
      isSubmitting={isSubmitting}
      onSubmit={async (values) => {
        const template = MOCK_PROJECT_TEMPLATES.find((item) => item.id === values.templateId);
        if (!template) {
          return { ok: false, message: "未找到模板" };
        }

        setIsSubmitting(true);
        try {
          const project = createMockProjectRecord(values, template);
          addProject(project);
          router.push(`/projects/${project.id}`);
          return { ok: true, projectId: project.id };
        } finally {
          setIsSubmitting(false);
        }
      }}
    />
  );
}

function ProjectCreateLoading() {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-5xl animate-pulse space-y-4">
        <div className="h-10 w-64 rounded bg-gray-200" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="h-[560px] rounded-xl bg-gray-200" />
          <div className="space-y-4">
            <div className="h-48 rounded-xl bg-gray-200" />
            <div className="h-48 rounded-xl bg-gray-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
