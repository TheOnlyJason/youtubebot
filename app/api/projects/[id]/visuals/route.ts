import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/db";
import { generateAllSceneImages } from "@/lib/ai/images";
import { forceResetVisualGeneration } from "@/lib/visuals/soraReconcile";
import { requestStopSoraGeneration, startSoraGeneration } from "@/lib/visuals/soraRunner";
import { fetchAllSceneStockVideos } from "@/lib/visuals/pexels";

export const dynamic = "force-dynamic";
export const maxDuration = 3600;

type VisualMode = "images" | "stock_video" | "sora";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = getProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!project.generatedScript) {
    return NextResponse.json({ error: "Generate a script first." }, { status: 400 });
  }
  if (project.scenes.length !== 5) {
    return NextResponse.json({ error: "Project needs 5 scenes." }, { status: 400 });
  }

  let mode: VisualMode = "images";
  let soraOptions: number | { sceneIndex?: number; retryFailed?: boolean } | undefined;
  let cancelSora = false;
  let resetSora = false;
  try {
    const body = (await req.json()) as {
      mode?: VisualMode;
      sceneIndex?: number;
      retryFailed?: boolean;
      cancel?: boolean;
      resetSora?: boolean;
    };
    if (body.mode === "stock_video" || body.mode === "images" || body.mode === "sora") {
      mode = body.mode;
    }
    if (body.resetSora === true) {
      resetSora = true;
    } else if (body.cancel === true) {
      cancelSora = true;
    } else if (body.retryFailed === true) {
      soraOptions = { retryFailed: true };
    } else if (typeof body.sceneIndex === "number" && body.sceneIndex >= 0 && body.sceneIndex < 5) {
      soraOptions = body.sceneIndex;
    }
  } catch {
    /* default images */
  }

  if (resetSora) {
    const reset = forceResetVisualGeneration(id);
    if (!reset.ok) {
      return NextResponse.json({ error: reset.error }, { status: 404 });
    }
    return NextResponse.json({ reset: true, project: reset.project });
  }

  if (cancelSora) {
    const stopped = requestStopSoraGeneration(id);
    const project = getProject(id);
    if (!stopped.ok && !project?.visualGeneration?.active) {
      return NextResponse.json({ stopped: true, project });
    }
    if (!stopped.ok) {
      return NextResponse.json(
        { error: stopped.error, project },
        { status: 409 },
      );
    }
    return NextResponse.json({ stopped: true, project: getProject(id) });
  }

  if (mode === "sora") {
    const started = startSoraGeneration(id, soraOptions);
    if (!started.ok) {
      return NextResponse.json(
        { error: started.error, project: getProject(id) },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { started: true, project: getProject(id) },
      { status: 202 },
    );
  }

  try {
    let scenes = project.scenes;
    if (mode === "stock_video") {
      scenes = await fetchAllSceneStockVideos(project);
    } else {
      scenes = await generateAllSceneImages(project);
    }

    const next = {
      ...project,
      scenes,
      updatedAt: new Date().toISOString(),
    };
    saveProject(next);
    return NextResponse.json({ project: next, mode });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Visual generation failed";
    const needsKey =
      message.includes("OPENAI_API_KEY") || message.includes("PEXELS_API_KEY");
    return NextResponse.json({ error: message }, { status: needsKey ? 400 : 500 });
  }
}
