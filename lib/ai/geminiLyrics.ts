import { scriptToFlatCaptionLines } from "@/lib/captions";
import { geminiErrorMessage } from "@/lib/ai/geminiErrors";
import {
  getLyricSourceKind,
  getSourceText,
  requireSourceText,
} from "@/lib/ai/sourceText";
import type { GeneratedScript, LyricSection, LyricSourceKind, ProjectForm } from "@/types";

const JSON_SCHEMA = `Respond with valid JSON only:
{
  "title": string,
  "description": string,
  "songConcept": string,
  "genre": string,
  "mood": string,
  "bpm": number,
  "primarySubject": string,
  "primarySetting": string,
  "lyricsSections": [
    {
      "label": "Intro" | "Verse" | "Chorus" | "Bridge" | "Outro",
      "lines": string[],
      "visual": string
    }
  ],
  "fullLyrics": string,
  "hashtags": string[],
  "estimatedDurationSeconds": number
}

lyricsSections: EXACTLY 5 sections in performance order.
Each section: 2–6 short singable lines. fullLyrics uses [Section] headers.

primarySubject / primarySetting: ONE visual subject and ONE location for the whole music video.
Each visual: 3–5 sentences, Sora-safe, same subject and setting every scene.`;

function systemPromptForSource(kind: LyricSourceKind): string {
  const base = `You turn user-provided SOURCE TEXT into 100% ORIGINAL song lyrics for a YouTube Short music video.

Rules:
- Do NOT copy famous songs or chart lyrics.
- Rewrite the story in your own singable words — same plot beats and emotion, not verbatim copying of long prose.
- Family-friendly / monetization-safe unless the source is clearly adult (still no slurs/hate).
- Catchy chorus that captures the core drama or punchline.
- Match genre, mood, and language requested.

${JSON_SCHEMA}`;

  if (kind === "messages") {
    return `${base}

SOURCE TYPE: Text message conversation between two or more people.

Adaptation style:
- Turn the chat into a song: tension, receipts, misunderstandings, or payoff from the thread.
- Verses can reflect different speakers or moments; chorus = the emotional headline of the drama.
- You may paraphrase message content; do not invent real phone numbers or doxxing details.
- title: short hook from the chat (e.g. "He Left Me on Read").`;
  }

  return `${base}

SOURCE TYPE: Reddit-style story post (AITA, TIFU, relationship, confession, etc.).

Adaptation style:
- Narrative song: setup in early verses, escalation, chorus = the twist or moral.
- Keep names generic unless the source uses clear pseudonyms only.
- title: clickable story headline vibe, original wording.`;
}

function buildUserPrompt(form: ProjectForm): string {
  const source = requireSourceText(form);
  const kind = getLyricSourceKind(form);
  const kindLabel = kind === "messages" ? "text messages" : "Reddit story";

  return `Transform this ${kindLabel} into original song lyrics JSON for a ${form.duration}s Short.

Genre: ${form.musicGenre ?? "pop"}
Mood / tone: ${form.tone}
Language for lyrics: ${form.language}
Audience: ${form.targetAudience}
Style reference (mood only, do not copy artists): ${form.artistStyle?.trim() || "none"}

--- SOURCE TEXT START ---
${source}
--- SOURCE TEXT END ---`;
}

function asLyricTuple(
  sections: LyricSection[],
): GeneratedScript["lyricsSections"] {
  if (sections.length !== 5) {
    throw new Error("Lyrics need exactly 5 sections.");
  }
  return sections as GeneratedScript["lyricsSections"];
}

function sectionText(section: LyricSection): string {
  return section.lines.filter(Boolean).join("\n");
}

export function finalizeLyricsScript(
  form: ProjectForm,
  raw: GeneratedScript,
): GeneratedScript {
  const sections = raw.lyricsSections;
  if (!sections || sections.length !== 5) {
    throw new Error("Invalid lyrics: need 5 lyricsSections.");
  }

  const sourceText = getSourceText(form);
  const tuple = asLyricTuple(sections)!;
  const fullLyrics =
    raw.fullLyrics?.trim() ||
    tuple
      .map((s) => `[${s.label}]\n${s.lines.join("\n")}`)
      .join("\n\n");

  const [intro, verse, chorus, bridge, outro] = tuple;
  const hook = sectionText(intro);
  const mainPoints: [string, string, string] = [
    sectionText(verse),
    sectionText(chorus),
    sectionText(bridge),
  ];
  const ending = sectionText(outro);
  const ctaLine =
    raw.ctaLine?.trim() ||
    (form.cta === "no CTA"
      ? ""
      : form.cta === "subscribe"
        ? "Subscribe for more."
        : form.cta === "follow"
          ? "Follow for the next story."
          : "Comment what you'd do.");

  const sceneVisualSuggestions = tuple.map((s) => s.visual?.trim() || s.lines.join(" "));

  return {
    ...raw,
    contentType: "music_lyrics",
    sourceText,
    lyricSourceKind: getLyricSourceKind(form),
    songConcept: raw.songConcept?.trim() || raw.title?.trim() || form.topic.trim(),
    genre: raw.genre?.trim() || form.musicGenre || "pop",
    mood: raw.mood?.trim() || form.tone,
    lyricsSections: tuple,
    fullLyrics,
    primarySubject: raw.primarySubject?.trim() || "same characters throughout the story",
    primarySetting: raw.primarySetting?.trim() || "one consistent music-video set",
    hook,
    mainPoints,
    ending,
    ctaLine,
    fullVoiceoverScript: fullLyrics,
    captionLines: raw.captionLines?.length
      ? raw.captionLines
      : scriptToFlatCaptionLines(fullLyrics),
    sceneVisualSuggestions,
    title: raw.title?.trim() || form.topic.trim() || "Story song",
    description:
      raw.description?.trim() ||
      `Song inspired by a ${getLyricSourceKind(form) === "messages" ? "text thread" : "Reddit story"}.`,
    estimatedDurationSeconds: raw.estimatedDurationSeconds ?? form.duration,
    hashtags: raw.hashtags?.length ? raw.hashtags : ["#StorySong", "#Shorts", "#OriginalMusic"],
  };
}

function mockLyrics(form: ProjectForm): GeneratedScript {
  const source = getSourceText(form) || "They said they'd be five minutes away.";
  const concept = source.split(/\n/)[0]?.trim().slice(0, 60) || "Story song";
  const sections: LyricSection[] = [
    {
      label: "Intro",
      lines: ["Read the thread again", "Same words on the screen"],
      visual: `Close-up on phone glow in a dark bedroom. Subject reads messages, mood ${form.tone}, cinematic 9:16.`,
    },
    {
      label: "Verse",
      lines: ["You said you were on your way", "But the typing dots went gray"],
      visual: `Same bedroom, same person, frustrated energy, consistent lighting and wardrobe.`,
    },
    {
      label: "Chorus",
      lines: ["This is the story in my head", "Every word you never said"],
      visual: `Medium shot, same subject, chorus energy, same room, emotional peak.`,
    },
    {
      label: "Bridge",
      lines: ["Screenshots in the camera roll", "Truth hits like a thunder roll"],
      visual: `Slow push-in, same setting, reflective mood.`,
    },
    {
      label: "Outro",
      lines: ["Archive the chat tonight", "Sing it out until it's right"],
      visual: `Pull-back wide, same room, subject puts phone down, soft resolution.`,
    },
  ];

  return finalizeLyricsScript(form, {
    title: concept,
    description: "Demo song from source text.",
    songConcept: concept,
    genre: form.musicGenre ?? "pop",
    mood: form.tone,
    bpm: 92,
    primarySubject: "person with smartphone",
    primarySetting: "bedroom at night",
    lyricsSections: sections as GeneratedScript["lyricsSections"],
    fullLyrics: "",
    hook: "",
    mainPoints: ["", "", ""],
    ending: "",
    ctaLine: "",
    fullVoiceoverScript: "",
    captionLines: [],
    sceneVisualSuggestions: sections.map((s) => s.visual),
    hashtags: ["#StorySong", "#Shorts"],
    estimatedDurationSeconds: form.duration,
  });
}

function parseLyricsJson(text: string, form: ProjectForm): GeneratedScript {
  const cleaned = text.replace(/```json\n?|```/g, "").trim();
  const data = JSON.parse(cleaned) as GeneratedScript;
  return finalizeLyricsScript(form, data);
}

async function geminiGenerateJson(prompt: string, kind: LyricSourceKind): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error("GEMINI_API_KEY is required. Add it to .env.local");
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPromptForSource(kind) }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(geminiErrorMessage(res.status, err));
  }

  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}

export async function generateLyricsWithGemini(
  form: ProjectForm,
): Promise<GeneratedScript> {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    return mockLyrics(form);
  }
  const kind = getLyricSourceKind(form);
  const text = await geminiGenerateJson(buildUserPrompt(form), kind);
  return parseLyricsJson(text, form);
}
