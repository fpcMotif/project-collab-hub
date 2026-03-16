import type { Metadata } from "next";

import { ProjectCreateScreen } from "@/features/project-create/components/project-create-screen";

export const metadata: Metadata = {
  title: "新建项目 - Project Collab Hub",
};

const ProjectCreatePage = () => {
  return <ProjectCreateScreen />;
};

export default ProjectCreatePage;