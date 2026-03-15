import type { Metadata } from "next";
import { ProjectDetailScreen } from "@/features/project-detail/components/ProjectDetailScreen";

export const metadata: Metadata = {
  title: "项目详情 - Project Collab Hub",
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return <ProjectDetailScreen projectId={projectId} />;
}
