import type { Metadata } from "next";

import { ProjectDetailScreen } from "@/features/project-detail/components/project-detail-screen";

export const metadata: Metadata = {
  title: "项目详情 - Project Collab Hub",
};

const ProjectDetailPage = async ({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) => {
  const { projectId } = await params;

  return <ProjectDetailScreen projectId={projectId} />;
};

export default ProjectDetailPage;