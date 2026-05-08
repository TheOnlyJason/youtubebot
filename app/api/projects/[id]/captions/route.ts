import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/db";
import { buildScenesForScript } from "@/lib/ai/script";
import { distributeCaptionLinesToScenes, scriptToFlatCaptionLines } from "@/lib/captions";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = getProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!project.generatedScript) {
    return NextResponse.json({ error: "No script" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as { fullScript?: string };
  const full = body.fullScript?.trim() || project.generatedScript.fullVoiceoverScript;
  const captionLines = scriptToFlatCaptionLines(full);
  const gs = { ...project.generatedScript, fullVoiceoverScript: full, captionLines };
  const scenes =
    project.scenes.length === 5
      ? distributeCaptionLinesToScenes(project.scenes, captionLines)
      : distributeCaptionLinesToScenes(
          buildScenesForScript(gs, project.form.duration),
          captionLines,
        );
  const next = { ...project, generatedScript: gs, scenes };
  saveProject(next);
  return NextResponse.json({ project: next });
}
