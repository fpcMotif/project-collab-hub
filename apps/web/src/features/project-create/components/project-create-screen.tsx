"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useMockProjectStore } from "@/features/board/hooks/use-mock-project-store";
import type { BoardProjectRecord } from "@/features/board/types";
import { convexFunctionRefs } from "@/lib/convex-function-refs";
import { useConvexEnabled } from "@/providers/convex-client-provider";

import { MOCK_PROJECT_TEMPLATES } from "../mock-templates";
import type {
  ConvexProjectTemplateDoc,
  ProjectCreateFormValues,
  ProjectTemplateOption,
} from "../types";
import { ProjectCreateForm } from "./project-create-form";

const CREATE_ACTOR_ID = "web_app.user";

const toProjectTemplateOption = (
  template: ConvexProjectTemplateDoc
): ProjectTemplateOption => ({
  approvalGates: template.approvalGates,
  defaultPriority: template.defaultPriority,
  departments: template.departments,
  description: template.description,
  id: template._id,
  name: template.name,
  version: template.version,
});

const createProjectId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `P-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }

  return `P-${Date.now().toString(36).toUpperCase()}`;
};

const createMockProjectRecord = (
  values: ProjectCreateFormValues,
  template: ProjectTemplateOption
): BoardProjectRecord => ({
  customerName: values.customerName.trim() || "未填写客户",
  departmentTracks: template.departments.map((department) => ({
    departmentName: department.departmentName,
    status: department.isRequired ? "not_started" : "not_required",
  })),
  id: createProjectId(),
  name: values.name.trim(),
  overdueTaskCount: 0,
  ownerName: values.ownerId.trim(),
  pendingApprovalCount: 0,
  priority: values.priority,
  slaRisk: "on_time",
  status: "new",
  templateType: template.name,
});

const ProjectCreateLoading = () => (
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

const ConnectedProjectCreateScreen = () => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const templatesQuery = useQuery(convexFunctionRefs.listProjectTemplates, {
    activeOnly: true,
  });
  const createProjectFromTemplate = useMutation(
    convexFunctionRefs.createProjectFromTemplate
  );

  const templates = useMemo(
    () => (templatesQuery ?? []).map(toProjectTemplateOption),
    [templatesQuery]
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
            createdBy: CREATE_ACTOR_ID,
            customerName: values.customerName.trim() || undefined,
            departmentId: values.departmentId,
            description: values.description.trim(),
            name: values.name.trim(),
            ownerId: values.ownerId.trim(),
            priority: values.priority,
            slaDeadline: values.slaDeadline
              ? new Date(`${values.slaDeadline}T09:00:00`).getTime()
              : undefined,
            sourceEntry: "workbench",
            templateId: values.templateId,
          });

          router.push(`/projects/${result.projectId}`);
          return { ok: true, projectId: result.projectId };
        } catch (error) {
          return {
            message: error instanceof Error ? error.message : String(error),
            ok: false,
          };
        } finally {
          setIsSubmitting(false);
        }
      }}
    />
  );
};

const MockProjectCreateScreen = () => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addProject } = useMockProjectStore();

  return (
    <ProjectCreateForm
      templates={MOCK_PROJECT_TEMPLATES}
      isSubmitting={isSubmitting}
      onSubmit={(values) => {
        const template = MOCK_PROJECT_TEMPLATES.find(
          (item) => item.id === values.templateId
        );
        if (!template) {
          return Promise.resolve({ message: "未找到模板", ok: false });
        }

        setIsSubmitting(true);
        try {
          const project = createMockProjectRecord(values, template);
          addProject(project);
          router.push(`/projects/${project.id}`);
          return Promise.resolve({ ok: true, projectId: project.id });
        } finally {
          setIsSubmitting(false);
        }
      }}
    />
  );
};

export const ProjectCreateScreen = () => {
  const convexEnabled = useConvexEnabled();

  if (convexEnabled) {
    return <ConnectedProjectCreateScreen />;
  }

  return <MockProjectCreateScreen />;
};
