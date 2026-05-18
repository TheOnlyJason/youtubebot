import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/db";
import { buildScenesForScript, generateScriptWithOpenAI } from "@/lib/ai/script";
import { runSafetyCheck, scanTopicForRiskyKeywords } from "@/lib/safety/checker";
import { distributeCaptionLinesToScenes } from "@/lib/captions";
import { deriveVisualContinuity } from "@/lib/visuals/continuity";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = getProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const script = await generateScriptWithOpenAI(project.form);
    const safety = runSafetyCheck(script, project.form.topic);
    const topicKeywordWarnings = scanTopicForRiskyKeywords(project.form.topic);
    let scenes = buildScenesForScript(script, project.form.duration);
    scenes = distributeCaptionLinesToScenes(scenes, script.captionLines);
    const visualContinuity = deriveVisualContinuity(
      project.form,
      script.sceneVisualSuggestions,
      {
        primarySubject: script.primarySubject,
        primarySetting: script.primarySetting,
        castDescription: script.castDescription,
        settingAndProps: script.settingAndProps,
      },
    );
    const next = {
      ...project,
      generatedScript: script,
      safetyReport: safety,
      visualContinuity,
      scenes,
      topicKeywordWarnings,
    };
    saveProject(next);
    return NextResponse.json({ project: next });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Script failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
