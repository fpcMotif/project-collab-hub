import { revalidatePath } from "next/cache";
import { runMutation, runQuery } from "@/lib/convexServer";

type ProjectTemplate = {
  _id: string;
  name: string;
  description: string;
  version: number;
  isActive: boolean;
  createdBy: string;
  updatedAt: number;
};

async function createTemplate(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const createdBy = String(formData.get("createdBy") ?? "admin").trim();

  if (!name || !description) {
    throw new Error("名称和描述不能为空");
  }

  await runMutation("projectTemplates:create", {
    name,
    description,
    createdBy,
    departments: [],
    approvalGates: [],
    notificationRules: [],
    chatPolicy: {
      autoCreateChat: true,
      addBotAsManager: true,
      pinProjectCard: true,
    },
    defaultPriority: "medium",
  });

  revalidatePath("/admin/templates");
}

async function createTemplateVersion(formData: FormData) {
  "use server";

  const sourceTemplateId = String(formData.get("sourceTemplateId") ?? "");
  const actorId = String(formData.get("actorId") ?? "admin").trim();

  if (!sourceTemplateId) {
    throw new Error("缺少模板 ID");
  }

  await runMutation("projectTemplates:createNewVersion", {
    sourceTemplateId,
    actorId,
  });

  revalidatePath("/admin/templates");
}

export default async function AdminTemplatesPage() {
  const templates = await runQuery<
    { activeOnly?: boolean },
    ProjectTemplate[]
  >("projectTemplates:list", {});

  return (
    <section className="grid gap-6">
      <article className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">创建模板</h2>
        <form action={createTemplate} className="mt-4 grid gap-3 md:max-w-xl">
          <input
            name="name"
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="模板名称"
            required
          />
          <textarea
            name="description"
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="模板描述"
            required
          />
          <input
            name="createdBy"
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="创建人 ID（默认 admin）"
          />
          <button
            type="submit"
            className="w-fit rounded-md bg-slate-900 px-4 py-2 text-white"
          >
            创建模板
          </button>
        </form>
      </article>

      <article className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">模板列表 / 升级版本</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="px-2 py-2">名称</th>
                <th className="px-2 py-2">版本</th>
                <th className="px-2 py-2">状态</th>
                <th className="px-2 py-2">更新时间</th>
                <th className="px-2 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template._id} className="border-b border-slate-100">
                  <td className="px-2 py-2">{template.name}</td>
                  <td className="px-2 py-2">v{template.version}</td>
                  <td className="px-2 py-2">
                    {template.isActive ? "active" : "inactive"}
                  </td>
                  <td className="px-2 py-2">
                    {new Date(template.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-2 py-2">
                    <form action={createTemplateVersion}>
                      <input
                        type="hidden"
                        name="sourceTemplateId"
                        value={template._id}
                      />
                      <input type="hidden" name="actorId" value="admin" />
                      <button
                        type="submit"
                        className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100"
                      >
                        升级版本
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
