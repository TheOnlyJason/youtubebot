import { sanitizeVisualText } from "@/lib/ai/moderationSafe";
import type { GeneratedScript, ProjectForm } from "@/types";

/** Infer a single visual subject from the user's topic when the model omits fields */
export function inferPrimarySubject(form: ProjectForm): string {
  const t = form.topic.trim();
  const lower = t.toLowerCase();
  if (/\b(dog|dogs|puppy|puppies|pet)\b/.test(lower)) {
    return "the same two dogs";
  }
  if (/\b(car|cars|vehicle)\b/.test(lower)) {
    return "the same car";
  }
  if (/\b(cat|cats)\b/.test(lower)) {
    return "the same cat";
  }
  if (/\b(person|people|man|woman|child)\b/.test(lower)) {
    return "the same person";
  }
  return t.length > 80 ? t.slice(0, 80).trim() : t;
}

export function inferPrimarySetting(form: ProjectForm): string {
  const t = form.topic.toLowerCase();
  if (/\b(dog|puppy|pet|backyard|park)\b/.test(t)) return "a sunny backyard";
  if (/\b(car|vehicle|drive|street|garage)\b/.test(t)) return "a suburban driveway";
  if (/\b(kitchen|food|cook|recipe)\b/.test(t)) return "a bright kitchen";
  if (/\b(office|desk|work)\b/.test(t)) return "a modern workspace";
  return "one consistent location matching the topic";
}

const SCENE_ACTIONS = [
  "wide establishing shot",
  "medium shot, action continues",
  "close-up on the key moment",
  "dynamic angle on the action",
  "closing shot, same scene",
] as const;

/** Ensure every visual line names the same subject and setting */
export function alignSceneVisualSuggestions(
  suggestions: string[],
  subject: string,
  setting: string,
): [string, string, string, string, string] {
  const subj = subject.replace(/^the same\s+/i, "").trim() || subject;
  const out = suggestions.slice(0, 5).map((raw, i) => {
    const line = raw?.trim() || "";
    const hasSubject =
      line.toLowerCase().includes(subj.toLowerCase().slice(0, Math.min(12, subj.length))) ||
      line.toLowerCase().includes(subject.toLowerCase().slice(0, 15));
    const hasSetting = line.toLowerCase().includes(setting.toLowerCase().slice(0, 8));
    if (hasSubject && hasSetting) return sanitizeVisualText(line);
    const action = line || (SCENE_ACTIONS[i] ?? "continuing action");
    return sanitizeVisualText(`In ${setting}, ${subject}: ${action}`);
  });
  while (out.length < 5) {
    const i = out.length;
    out.push(`In ${setting}, ${subject}: ${SCENE_ACTIONS[i] ?? "continuing action"}`);
  }
  return out as [string, string, string, string, string];
}

export function normalizeScriptSubject(
  form: ProjectForm,
  script: GeneratedScript,
): GeneratedScript {
  const primarySubject =
    script.primarySubject?.trim() ||
    script.castDescription?.trim() ||
    inferPrimarySubject(form);
  const primarySetting =
    script.primarySetting?.trim() ||
    script.settingAndProps?.trim() ||
    inferPrimarySetting(form);

  const sceneVisualSuggestions = alignSceneVisualSuggestions(
    script.sceneVisualSuggestions,
    primarySubject,
    primarySetting,
  );

  return {
    ...script,
    primarySubject,
    primarySetting,
    sceneVisualSuggestions,
    description:
      script.description?.trim() ||
      `A short about ${primarySubject} in ${primarySetting}.`,
  };
}
