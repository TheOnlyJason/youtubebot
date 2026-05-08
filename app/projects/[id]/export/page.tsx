import { notFound } from "next/navigation";
import { getProject } from "@/lib/db";
import { ExportClient } from "@/components/ExportClient";

export const dynamic = "force-dynamic";

export default async function ExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) notFound();
  return <ExportClient initialProject={project} />;
}
