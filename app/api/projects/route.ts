import { NextResponse } from "next/server";
import { listProjects, saveProject } from "@/lib/db";
import { createNewProject } from "@/lib/project";
import type { ProjectForm } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ projects: listProjects() });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { form?: Partial<ProjectForm> };
  const project = createNewProject(body.form);
  saveProject(project);
  return NextResponse.json({ project });
}
