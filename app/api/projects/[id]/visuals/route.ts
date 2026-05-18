import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/db";
import { generateAllSceneImages } from "@/lib/ai/images";
import { generateAllSceneSoraVideos, generateSceneSoraVideo } from "@/lib/ai/sora";
import { fetchAllSceneStockVideos } from "@/lib/visuals/pexels";

export const dynamic = "force-dynamic";
/** Sora jobs can take several minutes per scene when generating all five. */
export const maxDuration = 900;

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
  let sceneIndex: number | undefined;
  try {
    const body = (await req.json()) as { mode?: VisualMode; sceneIndex?: number };
    if (body.mode === "stock_video" || body.mode === "images" || body.mode === "sora") {
      mode = body.mode;
    }
    if (typeof body.sceneIndex === "number" && body.sceneIndex >= 0 && body.sceneIndex < 5) {
      sceneIndex = body.sceneIndex;
    }
  } catch {
    /* default images */
  }

  try {
    let scenes = project.scenes;
    if (mode === "stock_video") {
      scenes = await fetchAllSceneStockVideos(project);
    } else if (mode === "sora") {
      if (sceneIndex != null) {
        const file = await generateSceneSoraVideo(
          project.scenes[sceneIndex],
          sceneIndex,
          project,
        );
        scenes = project.scenes.map((s, i) =>
          i === sceneIndex
            ? {
                ...s,
                media: {
                  sourceType: "upload" as const,
                  fileRelativePath: file.relativePath,
                  mimeType: file.mimeType,
                },
              }
            : s,
        );
      } else {
        scenes = await generateAllSceneSoraVideos(project);
      }
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
