import { buildScenesForProject } from "@/lib/ai/generateProjectScript";
import { generateLyricsWithGemini } from "@/lib/ai/geminiLyrics";
import { generateLyriaMusic } from "@/lib/ai/lyria";
import { defaultTitleFromSource, getSourceText, requireSourceText } from "@/lib/ai/sourceText";
import { distributeCaptionLinesToScenes } from "@/lib/captions";
import { runSafetyCheck, scanTopicForRiskyKeywords } from "@/lib/safety/checker";
import { deriveVisualContinuity } from "@/lib/visuals/continuity";
import type { LyriaModelId, Project } from "@/types";

export async function adaptSourceToSongScript(project: Project): Promise<Project> {
  const sourceText = requireSourceText(project.form);
  const form = {
    ...project.form,
    sourceText,
    topic: project.form.topic.trim() || defaultTitleFromSource(sourceText),
  };

  const script = await generateLyricsWithGemini(form);
  const safety = runSafetyCheck(script, sourceText);
  const topicKeywordWarnings = scanTopicForRiskyKeywords(sourceText);
  let scenes = buildScenesForProject(script, form.duration, form);
  scenes = distributeCaptionLinesToScenes(scenes, script.captionLines);
  const visualContinuity = deriveVisualContinuity(form, script.sceneVisualSuggestions, {
    primarySubject: script.primarySubject,
    primarySetting: script.primarySetting,
    castDescription: script.castDescription,
    settingAndProps: script.settingAndProps,
  });

  return {
    ...project,
    form: { ...form, topic: script.title || form.topic },
    generatedScript: script,
    safetyReport: safety,
    visualContinuity,
    scenes,
    topicKeywordWarnings,
  };
}

export async function composeSongFromSource(
  project: Project,
  opts?: {
    instrumental?: boolean;
    model?: LyriaModelId;
    skipAdapt?: boolean;
  },
): Promise<{ project: Project; lyria: Awaited<ReturnType<typeof generateLyriaMusic>> }> {
  let p = project;
  if (!opts?.skipAdapt) {
    p = await adaptSourceToSongScript(p);
  } else {
    requireSourceText(p.form);
  }

  const result = await generateLyriaMusic(p, {
    instrumental: opts?.instrumental,
    model: opts?.model,
  });

  return { project: p, lyria: result };
}
