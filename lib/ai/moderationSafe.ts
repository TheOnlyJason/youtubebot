/**
 * Soften visual prompts for OpenAI image/video moderation (Sora, DALL·E).
 * Heuristic only — reduces false blocks; cannot guarantee approval.
 */

const WORD_REPLACEMENTS: [RegExp, string][] = [
  [/\bjealous(y)?\b/gi, "curious"],
  [/\benvious\b/gi, "interested"],
  [/\bwistful\b/gi, "thoughtful"],
  [/\bangry|furious|rage\b/gi, "surprised"],
  [/\bviolent|violence|fight|attacking\b/gi, "energetic"],
  [/\bweapon(s)?\b/gi, "prop"],
  [/\bblood(y)?\b/gi, "red"],
  [/\bsmartphone(s)?\b/gi, "small tablet"],
  [/\bcell\s*phone(s)?\b/gi, "small tablet"],
  [/\bphone\s+screen\b/gi, "tablet screen"],
  [/\bchecking\s+(his|her|their|a)\s+phone\b/gi, "glancing at a tablet"],
  [/\bphone\b/gi, "tablet"],
  [/\bemojis?\b/gi, "simple icons"],
  [/\btext\s+messages?\b/gi, "notifications"],
  [/\b(montage|compilation|highlights)\b/gi, "sequence"],
  [/\bother\s+cats\b/gi, "the same cat"],
  [/\bfriends\s+having\s+a\s+blast\b/gi, "a cheerful outdoor moment"],
  [/\bplaying\s+and\s+having\s+fun\s+in\s+a\s+park\b/gi, "relaxing in a sunny park"],
];

/** Strip phrases that often trigger video moderation */
const PHRASE_REMOVALS: RegExp[] = [
  /\bwith\s+playful\s+emojis\s+popping\s+up\s+on\s+screen\b/gi,
  /\bpop(ping)?\s+up\s+on\s+screen\b/gi,
  /\brecognizable\s+public\s+figures?\b/gi,
];

export function isModerationBlockError(message: string): boolean {
  return /moderation\s+system|content\s+policy|safety\s+system|flagged/i.test(message);
}

export function moderationBlockUserHint(sceneIndex?: number): string {
  const scene = sceneIndex != null ? ` (scene ${sceneIndex + 1})` : "";
  return (
    `OpenAI blocked this video prompt${scene}. Common triggers: phones/UI on screen, ` +
    `strong negative emotions, montages of different subjects, or brand logos. ` +
    `Edit the scene visual line below, then click “Sora — this scene only” to retry. ` +
    `The app will also auto-retry once with a softened prompt.`
  );
}

/** Rewrite a single visual line or prompt fragment */
export function sanitizeVisualText(text: string): string {
  let out = text;
  for (const re of PHRASE_REMOVALS) out = out.replace(re, "");
  for (const [re, rep] of WORD_REPLACEMENTS) out = out.replace(re, rep);
  return out.replace(/\s{2,}/g, " ").trim();
}

export const MODERATION_SAFE_SUFFIX =
  "Wholesome, family-friendly, G-rated educational B-roll. No weapons, gore, logos, " +
  "phone UI, social media interfaces, celebrities, or distress.";

/** Full prompt pass before sending to Sora / DALL·E */
export function finalizeVisualPrompt(prompt: string, extraSoft = false): string {
  const sanitized = sanitizeVisualText(prompt);
  const parts = [sanitized, MODERATION_SAFE_SUFFIX];
  if (extraSoft) {
    parts.push(
      "Simple single-subject shot. Static or slow camera. Avoid crowds, screens, and emotional distress.",
    );
  }
  return parts.join(" ");
}
