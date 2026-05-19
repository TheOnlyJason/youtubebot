import { generateLyricsWithGemini } from "@/lib/ai/geminiLyrics";
import { buildScenesForLyrics } from "@/lib/ai/lyricsScenes";
import { buildScenesForScript, generateScriptWithOpenAI } from "@/lib/ai/script";
import type { GeneratedScript, ProjectForm, Scene, ShortDuration } from "@/types";

export function isMusicLyricsProject(form: ProjectForm): boolean {
  return form.contentType === "music_lyrics";
}

export async function generateProjectScript(
  form: ProjectForm,
): Promise<GeneratedScript> {
  if (isMusicLyricsProject(form)) {
    return generateLyricsWithGemini(form);
  }
  return generateScriptWithOpenAI(form);
}

export function buildScenesForProject(
  script: GeneratedScript,
  duration: ShortDuration,
  form: ProjectForm,
): Scene[] {
  if (
    script.contentType === "music_lyrics" ||
    isMusicLyricsProject(form)
  ) {
    return buildScenesForLyrics(script, duration);
  }
  return buildScenesForScript(script, duration);
}
