import type {
  GeneratedScript,
  ProjectForm,
  ShortDuration,
} from "@/types";
import { buildDefaultScenesFromScript, scriptToFlatCaptionLines } from "@/lib/captions";
import type { Scene } from "@/types";

const SYSTEM_PROMPT = `You write original YouTube Shorts scripts. Do not copy text from existing articles, videos, captions, books, speeches, lyrics, or copyrighted sources. Do not include copyrighted quotes. Create concise, engaging, educational content. Keep the script suitable for monetization and advertiser-friendly.

You must respond with valid JSON only, matching this shape:
{
  "title": string,
  "description": string,
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

Rules:
- fullVoiceoverScript: single narration block, natural pacing for the target duration.
- mainPoints: exactly three distinct points.
- sceneVisualSuggestions: five entries aligned to hook, point1, point2, point3, ending+cta. Describe concrete B-roll a filmmaker could shoot (subjects, setting, action). Match the user's visualStyle: for realistic/cinematic/stock-footage use photorealistic scenes only (no cartoon/illustration).
- estimatedDurationSeconds should be close to the requested duration.
- No hashtags inside fullVoiceoverScript; put tags only in hashtags array.
- Language: match the user's language field.`;

function buildUserPrompt(form: ProjectForm): string {
  return `Niche: ${form.niche}
Topic: ${form.topic}
Tone: ${form.tone}
Target duration seconds: ${form.duration}
Voice style: ${form.voiceStyle}
Visual style: ${form.visualStyle}
CTA: ${form.cta}
Target audience: ${form.targetAudience}
Language: ${form.language}

Write the JSON script now.`;
}

/** Deterministic fallback when no API key — still original-ish template text */
function mockScript(form: ProjectForm): GeneratedScript {
  const dur = form.duration;
  const hook = `Here is one ${form.tone} idea about ${form.topic} for ${form.targetAudience}.`;
  const p1 = `First, frame the topic in simple terms anyone in ${form.language} can follow.`;
  const p2 = `Second, share one practical takeaway you can try today—no hype, just clarity.`;
  const p3 = `Third, explain why it matters in the long run for people interested in ${form.niche}.`;
  const ending = `Keep experimenting, stay curious, and make the idea your own.`;
  const cta =
    form.cta === "no CTA"
      ? ""
      : form.cta === "subscribe"
        ? "If you want more, subscribe for the next short."
        : form.cta === "follow"
          ? "Follow for more bite-sized lessons."
          : "Tell me what you would try first—drop a comment.";
  const full = [hook, p1, p2, p3, ending, cta].filter(Boolean).join(" ");
  const captionLines = scriptToFlatCaptionLines(full);
  return {
    title: `${form.topic} — ${form.niche} short`,
    description: `A ${form.tone}, advertiser-friendly short on ${form.topic} for ${form.targetAudience}.`,
    hook,
    mainPoints: [p1, p2, p3],
    ending,
    ctaLine: cta,
    fullVoiceoverScript: full,
    captionLines,
    sceneVisualSuggestions: [
      `Bold ${form.visualStyle} visual suggesting curiosity about ${form.topic}.`,
      `Clean diagram or iconography for point one (${form.visualStyle}).`,
      `Simple metaphor image for point two.`,
      `Minimal text-on-shape for point three.`,
      `Calm closing frame with space for ${form.cta === "no CTA" ? "brand" : "CTA"}.`,
    ],
    hashtags: [`#${form.niche.replace(/\s+/g, "")}`, "#Shorts", "#LearnSomething"],
    estimatedDurationSeconds: dur,
  };
}

function parseScriptJson(text: string): GeneratedScript {
  const cleaned = text.replace(/```json\n?|```/g, "").trim();
  const data = JSON.parse(cleaned) as GeneratedScript;
  if (!data.mainPoints || data.mainPoints.length !== 3) {
    throw new Error("Invalid script: need three mainPoints");
  }
  return {
    ...data,
    estimatedDurationSeconds:
      data.estimatedDurationSeconds ?? 30,
  };
}

/**
 * Generate script via OpenAI-compatible Chat Completions API.
 * Set OPENAI_API_KEY + OPENAI_SCRIPT_MODEL (optional, default gpt-4o-mini).
 * Swap provider: replace fetch URL / headers in this module.
 */
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
      temperature: 0.7,
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
  return parseScriptJson(content);
}

export function buildScenesForScript(
  script: GeneratedScript,
  duration: ShortDuration,
): Scene[] {
  return buildDefaultScenesFromScript({
    hook: script.hook,
    mainPoints: script.mainPoints,
    ending: script.ending,
    ctaLine: script.ctaLine,
    targetDuration: duration,
  }).map((scene, idx) => ({
    ...scene,
    visualSuggestion: script.sceneVisualSuggestions[idx],
  }));
}
