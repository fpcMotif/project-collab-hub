"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { PRIORITY_OPTIONS, PRIORITY_LABELS } from "@/features/board/constants";

import type { ProjectCreateFormValues, ProjectTemplateOption } from "../types";

interface ProjectCreateFormProps {
  templates: ProjectTemplateOption[];
  isSubmitting?: boolean;
  onSubmit: (
    values: ProjectCreateFormValues
  ) => Promise<{ ok: boolean; projectId?: string; message?: string }>;
}

const Field = ({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) => (
  <label className={className}>
    <span className="mb-1.5 block text-sm font-medium text-gray-700">
      {label}
    </span>
    {children}
  </label>
);

const createInitialValues = (templateId: string): ProjectCreateFormValues => ({
  customerName: "",
  departmentId: "",
  description: "",
  name: "",
  ownerId: "",
  priority: "medium",
  slaDeadline: "",
  templateId,
});

export const ProjectCreateForm = ({
  templates,
  isSubmitting = false,
  onSubmit,
}: ProjectCreateFormProps) => {
  const [values, setValues] = useState<ProjectCreateFormValues>(() =>
    createInitialValues(templates[0]?.id ?? "")
  );
  const [notice, setNotice] = useState<string | null>(null);
  const selectedTemplate = useMemo(
    () =>
      templates.find((template) => template.id === values.templateId) ??
      templates[0] ??
      null,
    [templates, values.templateId]
  );

  const departmentOptions = selectedTemplate?.departments ?? [];

  const handleFieldChange = <K extends keyof ProjectCreateFormValues>(
    key: K,
    value: ProjectCreateFormValues[K]
  ) => {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "templateId") {
        const nextTemplate =
          templates.find((template) => template.id === value) ?? null;
        next.priority = nextTemplate?.defaultPriority ?? "medium";
        next.departmentId = nextTemplate?.departments[0]?.departmentId ?? "";
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    const result = await onSubmit(values);
    if (!result.ok) {
      setNotice(result.message ?? "创建失败，请检查表单后重试");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <Link
              href="/board"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              ← 返回项目看板
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">新建项目</h1>
            <p className="mt-1 text-sm text-gray-500">
              按模板快速生成项目卡片、部门工作流和默认协同结构。
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-4 px-6 py-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="模板">
              <select
                value={values.templateId}
                onChange={(event) =>
                  handleFieldChange("templateId", event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} · v{template.version}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="项目名称">
              <input
                value={values.name}
                onChange={(event) =>
                  handleFieldChange("name", event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
                placeholder="请输入项目名称"
              />
            </Field>

            <Field label="客户">
              <input
                value={values.customerName}
                onChange={(event) =>
                  handleFieldChange("customerName", event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
                placeholder="请输入客户名称"
              />
            </Field>

            <Field label="负责人">
              <input
                value={values.ownerId}
                onChange={(event) =>
                  handleFieldChange("ownerId", event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
                placeholder="例如：李明"
              />
            </Field>

            <Field label="归属部门">
              <select
                value={values.departmentId}
                onChange={(event) =>
                  handleFieldChange("departmentId", event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
              >
                <option value="">请选择部门</option>
                {departmentOptions.map((department) => (
                  <option
                    key={department.departmentId}
                    value={department.departmentId}
                  >
                    {department.departmentName}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="优先级">
              <select
                value={values.priority}
                onChange={(event) =>
                  handleFieldChange(
                    "priority",
                    event.target.value as ProjectCreateFormValues["priority"]
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="SLA 截止时间">
              <input
                type="date"
                value={values.slaDeadline}
                onChange={(event) =>
                  handleFieldChange("slaDeadline", event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
              />
            </Field>
          </div>

          <Field label="项目描述" className="mt-4">
            <textarea
              rows={5}
              value={values.description}
              onChange={(event) =>
                handleFieldChange("description", event.target.value)
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
              placeholder="描述项目范围、关键背景和交付目标"
            />
          </Field>

          {notice && <p className="mt-4 text-sm text-red-600">{notice}</p>}

          <div className="mt-5 flex items-center justify-end gap-3">
            <Link
              href="/board"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-400"
            >
              取消
            </Link>
            <button
              type="button"
              disabled={
                isSubmitting ||
                !values.templateId ||
                !values.name.trim() ||
                !values.ownerId.trim() ||
                !values.departmentId
              }
              onClick={() => {
                handleSubmit();
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isSubmitting ? "创建中…" : "创建项目"}
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">模板预览</h2>
            {selectedTemplate ? (
              <>
                <p className="mt-2 text-sm text-gray-600">
                  {selectedTemplate.description}
                </p>
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                  <span>版本 v{selectedTemplate.version}</span>
                  <span>·</span>
                  <span>
                    默认优先级{" "}
                    {PRIORITY_LABELS[selectedTemplate.defaultPriority]}
                  </span>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-gray-400">暂无可用模板</p>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">
              默认部门工作流
            </h2>
            <div className="mt-3 space-y-2">
              {selectedTemplate?.departments.map((department) => (
                <div
                  key={department.departmentId}
                  className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700"
                >
                  {department.departmentName}
                  <span className="ml-2 text-xs text-gray-400">
                    {department.isRequired ? "必需" : "可选"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">
              默认审批链
            </h2>
            <div className="mt-3 space-y-2">
              {selectedTemplate?.approvalGates.length ? (
                selectedTemplate.approvalGates.map((gate) => (
                  <div
                    key={`${gate.approvalCode}-${gate.triggerStage}`}
                    className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700"
                  >
                    {gate.title}
                    <p className="mt-1 text-xs text-gray-400">
                      触发阶段：{gate.triggerStage}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">该模板暂无默认审批门禁</p>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};
