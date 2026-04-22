import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { ProjectDetailScreen } from "@/features/project-detail/components/project-detail-screen";

const routeApi = getRouteApi("/projects/$projectId");

const ProjectDetailPage = () => {
  const { projectId } = routeApi.useParams();
  return <ProjectDetailScreen projectId={projectId} />;
};

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectDetailPage,
  head: () => ({
    meta: [{ title: "项目详情 - Project Collab Hub" }],
  }),
});
