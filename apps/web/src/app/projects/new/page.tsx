import type { Metadata } from "next";

import { ProjectCreateScreen } from "@/features/project-create/components/ProjectCreateScreen";

export const metadata: Metadata = {
  title: "新建项目 - Project Collab Hub",
};

export default function ProjectCreatePage() {
  return <ProjectCreateScreen />;
}
