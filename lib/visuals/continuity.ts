import type { ProjectForm, VisualContinuity, VisualStyle } from "@/types";

function hashTopic(topic: string): number {
  let h = 0;
  for (let i = 0; i < topic.length; i++) h = (h * 31 + topic.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const BASE_PALETTES: [number, number, number][] = [
  [26, 26, 46],
  [22, 33, 62],
  [30, 42, 58],
  [38, 32, 52],
  [28, 38, 36],
];

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, "0");
  return `0x${c(r)}${c(g)}${c(b)}`;
}

/** Five related background hex values from one hue family */
function cohesiveBackgrounds(hue: number): [string, string, string, string, string] {
  const pick = BASE_PALETTES[hue % BASE_PALETTES.length];
  const factors = [0.85, 0.95, 1, 0.92, 0.88];
  return factors.map((f) => toHex(pick[0] * f, pick[1] * f, pick[2] * f)) as [
    string,
    string,
    string,
    string,
    string,
  ];
}

function inferSubjectLabel(form: ProjectForm): string {
  const t = form.topic.trim();
  if (t.length <= 60) return t;
  return `the subject of this short (${t.slice(0, 50)}…)`;
}

function defaultSetting(form: ProjectForm): string {
  const t = form.topic.toLowerCase();
  if (/\b(dog|puppy|pet)\b/.test(t)) return "the same sunny backyard or park throughout";
  if (/\b(car|vehicle|drive)\b/.test(t)) return "the same suburban street or driveway throughout";
  if (/\b(kitchen|food|cook|recipe)\b/.test(t)) return "the same bright kitchen throughout";
  if (/\b(office|desk|work)\b/.test(t)) return "the same modern workspace throughout";
  return `one consistent setting that fits "${form.topic}" (do not change location between scenes)`;
}

function lightingForTone(tone: ProjectForm["tone"]): string {
  switch (tone) {
    case "dramatic":
      return "dramatic but consistent side lighting, same time of day";
    case "mysterious":
      return "soft overcast light, same moody atmosphere";
    case "funny":
      return "bright even daylight, cheerful and consistent";
    case "educational":
      return "clear neutral daylight, even exposure";
    default:
      return "warm natural daylight, same sun angle across shots";
  }
}

function paletteForStyle(style: VisualStyle): string {
  switch (style) {
    case "cinematic":
      return "cinematic teal-and-warm skin tones, muted shadows";
    case "minimal":
      return "soft neutrals, low saturation, airy highlights";
    case "animated":
      return "clean bold colors from one limited palette";
    default:
      return "natural realistic colors, cohesive white balance";
  }
}

/** Build shared look for all scenes in a project */
export function deriveVisualContinuity(
  form: ProjectForm,
  sceneVisualSuggestions?: string[],
  scriptMeta?: {
    primarySubject?: string;
    primarySetting?: string;
    castDescription?: string;
    settingAndProps?: string;
  },
): VisualContinuity {
  const hue = hashTopic(form.topic) % 360;
  const subject =
    scriptMeta?.castDescription?.trim() ||
    scriptMeta?.primarySubject?.trim() ||
    inferSubjectLabel(form);
  const setting =
    scriptMeta?.settingAndProps?.trim() ||
    scriptMeta?.primarySetting?.trim() ||
    sceneVisualSuggestions?.[0]?.match(/\b(in|at|on)\s+([^,.]+)/i)?.[2]?.trim() ||
    defaultSetting(form);

  return {
    setting: `Keep the exact same location and props: ${setting}. Same cast throughout: ${subject}.`,
    lighting: lightingForTone(form.tone),
    palette: paletteForStyle(form.visualStyle),
    colorGrade: "consistent color grade and white balance across every shot",
    sceneBackgrounds: cohesiveBackgrounds(hue),
  };
}

export function continuityPromptBlock(
  continuity: VisualContinuity,
  sceneIndex: number,
  sceneCount: number,
  priorSceneSummary?: string,
): string {
  const parts = [
    "VISUAL CONTINUITY (required):",
    continuity.setting,
    `Lighting: ${continuity.lighting}.`,
    `Palette: ${continuity.palette}.`,
    `Color grade: ${continuity.colorGrade}.`,
    `This is scene ${sceneIndex + 1} of ${sceneCount} in one continuous short — match the previous shot.`,
  ];
  if (priorSceneSummary?.trim()) {
    parts.push(`Previous shot ended with: ${priorSceneSummary.trim()}`);
    parts.push("Continue smoothly from that moment; same environment and lighting.");
  }
  return parts.join(" ");
}
