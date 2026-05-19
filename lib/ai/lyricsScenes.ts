import { buildDefaultScenesFromScript } from "@/lib/captions";
import type { GeneratedScript, Scene, ShortDuration } from "@/types";

/** Map 5 lyric sections to 5 Short scenes */
export function buildScenesForLyrics(
  script: GeneratedScript,
  duration: ShortDuration,
): Scene[] {
  const sections = script.lyricsSections;
  const base = buildDefaultScenesFromScript({
    hook: script.hook,
    mainPoints: script.mainPoints,
    ending: script.ending,
    ctaLine: script.ctaLine,
    targetDuration: duration,
  });

  return base.map((scene, idx) => {
    const section = sections?.[idx];
    const caption = section?.lines?.filter(Boolean).join(" / ") || scene.caption;
    return {
      ...scene,
      caption,
      visualSuggestion:
        script.sceneVisualSuggestions[idx] ??
        section?.visual ??
        scene.visualSuggestion,
    };
  });
}
