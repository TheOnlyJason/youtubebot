import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/db";
import { canRender } from "@/lib/projectStatus";
import { renderVerticalMp4 } from "@/lib/video/ffmpeg";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = getProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const gate = canRender(project);
  if (!gate.ok) {
    return NextResponse.json({ error: "Cannot render", reasons: gate.reasons }, { status: 400 });
  }

  const running = {
    ...project,
    render: {
      status: "running" as const,
      message: "Rendering…",
      startedAt: new Date().toISOString(),
    },
  };
  saveProject(running);

  try {
    const out = await renderVerticalMp4(running);
    const done = {
      ...running,
      render: {
        status: "done" as const,
        message: "Render complete",
        outputRelativePath: out.relativeOutput,
        startedAt: running.render.startedAt,
        finishedAt: new Date().toISOString(),
      },
    };
    saveProject(done);
    return NextResponse.json({ project: done });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Render failed";
    const failed = {
      ...running,
      render: {
        status: "error" as const,
        message,
        startedAt: running.render.startedAt,
        finishedAt: new Date().toISOString(),
      },
    };
    saveProject(failed);
    const badInput =
      message.includes("Voiceover missing") ||
      message.includes("Missing media") ||
      message.includes("Script required");
    const ffmpegSetup =
      message.includes("ffmpeg was not found") || message.includes("FFMPEG_PATH is");
    return NextResponse.json(
      { error: message, project: failed },
      { status: badInput ? 400 : ffmpegSetup ? 503 : 500 },
    );
  }
}
