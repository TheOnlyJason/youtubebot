import { notFound } from "next/navigation";
import { getProject } from "@/lib/db";
import { reconcileProjectState } from "@/lib/visuals/soraReconcile";
import { ProjectWorkspace } from "@/components/ProjectWorkspace";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const raw = getProject(id);
  if (!raw) notFound();
  const project = reconcileProjectState(raw);
  return <ProjectWorkspace initialProject={project} />;
}
