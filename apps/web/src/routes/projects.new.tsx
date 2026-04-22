import { createFileRoute } from "@tanstack/react-router";

import { ProjectCreateScreen } from "@/features/project-create/components/project-create-screen";

export const Route = createFileRoute("/projects/new")({
  component: ProjectCreateScreen,
  head: () => ({
    meta: [{ title: "新建项目 - Project Collab Hub" }],
  }),
});
