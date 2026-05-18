import type {
  GeneratedScript,
  ProjectForm,
  ShortDuration,
} from "@/types";
import { buildDefaultScenesFromScript } from "@/lib/captions";
import { normalizeScriptSubject } from "@/lib/ai/scriptSubject";
import { finalizeSkitScript, mockSkitBeats } from "@/lib/ai/skitScript";
import type { Scene } from "@/types";

const SYSTEM_PROMPT = `You write original comedy SKITS for YouTube Shorts — short story scenes with the same characters throughout.

This is NOT a documentary, NOT a listicle, NOT "did you know" facts, NOT an essay. Write like a funny visual skit (setup → problem → escalation → payoff → button).

The user provides a skit title/concept (example: "Skit 1 — Bath Bubble Betrayal").

Respond with valid JSON only:
{
  "title": string,
  "description": string,
  "skitConcept": string,
  "castDescription": string,
  "settingAndProps": string,
  "primarySubject": string,
  "primarySetting": string,
  "skitBeats": [
    {
      "label": "Setup" | "Complication" | "Escalation" | "Payoff" | "Button",
      "action": string,
      "dialogue": string,
      "visual": string
    }
    (exactly 5 beats in this order)
  ],
  "hook": string,
  "mainPoints": [string, string, string],
  "ending": string,
  "ctaLine": string,
  "fullVoiceoverScript": string,
  "captionLines": [{ "text": string, "highlights"?: string[] }],
  "sceneVisualSuggestions": [string, string, string, string, string],
  "hashtags": string[],
  "estimatedDurationSeconds": number
}

CAST & SETTING (critical for video AI):
- castDescription: ONE locked cast for all 5 scenes — exact count, species, colors, size, outfits/accessories. Never add or swap characters.
- settingAndProps: ONE location + recurring props only. No scene hops to a park, office, or different room.
- primarySubject / primarySetting: short summaries of the same cast and place.

SKIT BEATS (critical):
- skitBeats: exactly 5 beats labeled Setup, Complication, Escalation, Payoff, Button.
- action: 2–4 sentences of story detail for that moment — what the SAME cast does (physical comedy, reactions).
- dialogue: 1–2 short spoken lines for voiceover — witty, conversational, in-character. Not narrator facts.
- visual: 3–6 sentences for one filmed shot. MUST repeat the same cast traits from castDescription and same setting/props from settingAndProps. Include camera (wide/medium/close), pose, action, lighting. No new characters, objects, or locations. Sora-safe: G-rated, no phone screens/UI, no logos, no violence.

Also fill hook, mainPoints (beats 2–4 dialogue), ending (beat 5), fullVoiceoverScript (all dialogues flowing as one skit), sceneVisualSuggestions (copy each beat's visual).

Tone: match user tone (funny = playful; dramatic = heightened comedy). visualStyle realistic/cinematic = photorealistic cats/people/objects, not cartoon unless animated.

Language: user language field. estimatedDurationSeconds ≈ target duration.`;

function buildUserPrompt(form: ProjectForm): string {
  return `Skit concept: ${form.topic}
Tone: ${form.tone}
Target duration seconds: ${form.duration}
Voice style: ${form.voiceStyle}
Visual style: ${form.visualStyle}
CTA preference: ${form.cta}
Audience: ${form.targetAudience}
Language: ${form.language}

Expand this into a 5-beat comedy skit JSON. Same cast and setting in every beat. Story skit, not documentary.

Write the JSON now.`;
}

function mockScript(form: ProjectForm): GeneratedScript {
  const beats = mockSkitBeats(form);
  const ctaLine =
    form.cta === "no CTA"
      ? ""
      : form.cta === "subscribe"
        ? "Subscribe for the next skit."
        : form.cta === "follow"
          ? "Follow for more skits."
          : "Comment your favorite moment.";
  const raw: GeneratedScript = {
    title: form.topic.trim() || "Untitled skit",
    description: `A ${form.tone} comedy skit.`,
    skitConcept: form.topic.trim(),
    castDescription: "two fluffy orange tabby cats with matching tiny bow ties",
    settingAndProps:
      "a clawfoot bathtub with white bubbles, pastel blue tiles, one yellow rubber duck",
    primarySubject: "two orange tabby cats in bow ties",
    primarySetting: "a pastel bathroom bubble bath",
    skitBeats: beats as GeneratedScript["skitBeats"],
    hook: beats[0]!.dialogue,
    mainPoints: [beats[1]!.dialogue, beats[2]!.dialogue, beats[3]!.dialogue],
    ending: beats[4]!.dialogue,
    ctaLine,
    fullVoiceoverScript: "",
    captionLines: [],
    sceneVisualSuggestions: beats.map((b) => b.visual),
    hashtags: ["#Skit", "#Shorts", "#Comedy"],
    estimatedDurationSeconds: form.duration,
  };
  return normalizeScriptSubject(form, finalizeSkitScript(form, raw));
}

function parseScriptJson(text: string, form: ProjectForm): GeneratedScript {
  const cleaned = text.replace(/```json\n?|```/g, "").trim();
  const data = JSON.parse(cleaned) as GeneratedScript;

  if (!data.skitBeats || data.skitBeats.length !== 5) {
    if (!data.mainPoints || data.mainPoints.length !== 3) {
      throw new Error("Invalid script: need skitBeats (5) or legacy mainPoints (3).");
    }
    return normalizeScriptSubject(form, {
      ...data,
      estimatedDurationSeconds: data.estimatedDurationSeconds ?? form.duration,
    });
  }

  const finalized = finalizeSkitScript(form, {
    ...data,
    estimatedDurationSeconds: data.estimatedDurationSeconds ?? form.duration,
  });
  return normalizeScriptSubject(form, finalized);
}

export async function generateScriptWithOpenAI(
  form: ProjectForm,
): Promise<GeneratedScript> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return mockScript(form);
  }
  const model = process.env.OPENAI_SCRIPT_MODEL || "gpt-4o-mini";
  const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.85,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(form) },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Script API error: ${res.status} ${err}`);
  }
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty script response");
  return parseScriptJson(content, form);
}

export function buildScenesForScript(
  script: GeneratedScript,
  duration: ShortDuration,
): Scene[] {
  const beats = script.skitBeats;
  const base = buildDefaultScenesFromScript({
    hook: script.hook,
    mainPoints: script.mainPoints,
    ending: script.ending,
    ctaLine: script.ctaLine,
    targetDuration: duration,
  });

  return base.map((scene, idx) => {
    const beat = beats?.[idx];
    return {
      ...scene,
      caption: beat?.dialogue?.trim() || scene.caption,
      visualSuggestion:
        script.sceneVisualSuggestions[idx] ?? beat?.visual ?? scene.visualSuggestion,
    };
  });
}
