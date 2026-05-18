import { scriptToFlatCaptionLines } from "@/lib/captions";
import {
  alignSceneVisualSuggestions,
  inferPrimarySetting,
  inferPrimarySubject,
} from "@/lib/ai/scriptSubject";
import type { GeneratedScript, ProjectForm, SkitSceneBeat } from "@/types";

const BEAT_LABELS = ["Setup", "Complication", "Escalation", "Payoff", "Button"] as const;

/** Build legacy fields + visuals from structured skit beats */
export function finalizeSkitScript(
  form: ProjectForm,
  raw: GeneratedScript,
): GeneratedScript {
  const beats = raw.skitBeats?.length === 5 ? raw.skitBeats : null;
  if (!beats) {
    return raw;
  }

  const skitConcept = raw.skitConcept?.trim() || form.topic.trim();
  const castDescription =
    raw.castDescription?.trim() || raw.primarySubject?.trim() || inferPrimarySubject(form);
  const settingAndProps =
    raw.settingAndProps?.trim() || raw.primarySetting?.trim() || inferPrimarySetting(form);
  const primarySubject = raw.primarySubject?.trim() || castDescription.slice(0, 120);
  const primarySetting = raw.primarySetting?.trim() || settingAndProps.slice(0, 120);

  const visualsFromBeats = beats.map((b) => b.visual?.trim() || b.action?.trim() || b.dialogue);
  const sceneVisualSuggestions = alignSceneVisualSuggestions(
    visualsFromBeats,
    primarySubject,
    primarySetting,
  );

  const hook = beats[0].dialogue?.trim() || beats[0].action;
  const mainPoints: [string, string, string] = [
    beats[1].dialogue?.trim() || beats[1].action,
    beats[2].dialogue?.trim() || beats[2].action,
    beats[3].dialogue?.trim() || beats[3].action,
  ];
  const endingLine = beats[4].dialogue?.trim() || beats[4].action;
  const ctaLine = raw.ctaLine?.trim() ?? "";
  const ending = endingLine;

  const fullParts = beats.map((b) => b.dialogue?.trim()).filter(Boolean);
  if (ctaLine && form.cta !== "no CTA") fullParts.push(ctaLine);
  const fullVoiceoverScript =
    raw.fullVoiceoverScript?.trim() || fullParts.join(" ");

  return {
    ...raw,
    skitConcept,
    castDescription,
    settingAndProps,
    primarySubject,
    primarySetting,
    skitBeats: beats,
    hook,
    mainPoints,
    ending,
    ctaLine,
    fullVoiceoverScript,
    captionLines: raw.captionLines?.length
      ? raw.captionLines
      : scriptToFlatCaptionLines(fullVoiceoverScript),
    sceneVisualSuggestions,
    title: raw.title?.trim() || skitConcept,
    description:
      raw.description?.trim() ||
      `Comedy skit: ${skitConcept}. Same cast and setting in every scene.`,
    estimatedDurationSeconds: raw.estimatedDurationSeconds ?? form.duration,
    hashtags: raw.hashtags?.length
      ? raw.hashtags
      : ["#Skit", "#Shorts", "#Comedy"],
  };
}

/** Offline template when no API key */
export function mockSkitBeats(form: ProjectForm): SkitSceneBeat[] {
  const concept = form.topic.trim() || "Skit — Bubble Bath Betrayal";
  const cast =
    "two fluffy orange tabby cats, same size and face, wearing matching tiny bow ties";
  const setting =
    "a clawfoot bathtub filled with white bubbles, pastel blue bathroom tiles, one rubber duck";

  return [
    {
      label: "Setup",
      action: `Both cats sit side by side in the bubble bath, pretending to be fancy spa guests. They nod seriously at each other like executives.`,
      dialogue: `Welcome to the fanciest bubble bath in town — try to look expensive.`,
      visual: `Wide shot, ${setting}. ${cast} seated together in the tub, bubbles up to their chins, both wearing bow ties, warm soft bathroom lighting, photorealistic, vertical 9:16.`,
    },
    {
      label: "Complication",
      action: `One cat slowly sinks the rubber duck under the bubbles while the other watches, horrified.`,
      dialogue: `Did you just… drown Mr. Quackers?`,
      visual: `Medium shot, same ${setting}. Same ${cast}; one cat pushes the yellow rubber duck under foam while the other cat's eyes widen, same lighting and outfits.`,
    },
    {
      label: "Escalation",
      action: `They splash politely but increasingly fast; bubbles fly; both pretend it is still classy.`,
      dialogue: `This is still elegant! Totally elegant!`,
      visual: `Dynamic medium shot, same bathroom and tub. Same two cats splashing, bubbles in the air, bow ties slightly wet, no new characters or props.`,
    },
    {
      label: "Payoff",
      action: `Both cats freeze, covered in bubbles, staring at the camera like they have been caught.`,
      dialogue: `…We were never fancy, were we?`,
      visual: `Close-up on same ${cast} in the same tub, foam on their heads and whiskers, guilty expressions, identical bow ties, soft key light.`,
    },
    {
      label: "Button",
      action: `They slowly sink back into the bubbles until only eyes and bow ties show.`,
      dialogue:
        form.cta === "no CTA"
          ? `See you at the next spa day.`
          : `Subscribe for more bubble drama.`,
      visual: `Wide closing shot, same ${setting}. Same cats submerged to eye level in bubbles, bow ties visible, cozy comedic ending frame, vertical 9:16.`,
    },
  ];
}

export function defaultBeatLabels(): readonly string[] {
  return BEAT_LABELS;
}
