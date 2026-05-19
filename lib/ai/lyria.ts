import { getLyricSourceKind, getSourceText } from "@/lib/ai/sourceText";
import type { GeneratedScript, LyriaModelId, Project, ProjectForm } from "@/types";

const CLIP_MODEL: LyriaModelId = "lyria-3-clip-preview";
const PRO_MODEL: LyriaModelId = "lyria-3-pro-preview";

export interface LyriaGenerateResult {
  model: LyriaModelId;
  audio: Buffer;
  mimeType: string;
  lyricsText: string;
  structureText: string;
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
}

function geminiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error("GEMINI_API_KEY is required for Lyria music. Add it to .env.local");
  }
  return key;
}

/** Clip = 30s; Pro = longer songs — match Short duration when possible */
export function resolveLyriaModel(form: ProjectForm): LyriaModelId {
  const env = process.env.LYRIA_MODEL?.trim() as LyriaModelId | undefined;
  if (env === CLIP_MODEL || env === PRO_MODEL) return env;
  if (form.lyriaModel === CLIP_MODEL || form.lyriaModel === PRO_MODEL) {
    return form.lyriaModel;
  }
  return form.duration <= 30 ? CLIP_MODEL : PRO_MODEL;
}

function sectionLyricsBlock(script: GeneratedScript): string | null {
  const sections = script.lyricsSections;
  if (!sections?.length) return null;
  return sections
    .map((s) => `[${s.label}]\n${s.lines.filter(Boolean).join("\n")}`)
    .join("\n\n");
}

export function buildLyriaPrompt(
  project: Project,
  opts?: { instrumental?: boolean },
): string {
  const form = project.form;
  const script = project.generatedScript;
  const genre = script?.genre ?? form.musicGenre ?? "pop";
  const mood = script?.mood ?? form.tone;
  const lang = form.language;
  const sourceText = getSourceText(form, script);
  const sourceKind = getLyricSourceKind(form, script);
  const concept = script?.songConcept?.trim() || form.topic.trim() || "story song";
  const model = resolveLyriaModel(form);
  const instrumental = opts?.instrumental === true;

  const lines: string[] = [];
  const storyNote =
    sourceKind === "messages"
      ? "The song is based on a text message conversation — conversational, dramatic, singable."
      : "The song is based on a Reddit-style story — narrative arc with a catchy chorus hook.";

  if (model === CLIP_MODEL) {
    lines.push(
      `Create a 30-second ${genre} song in ${lang}. Mood: ${mood}.`,
      storyNote,
      `Story hook: ${concept}.`,
    );
  } else {
    const sec = Math.min(180, Math.max(45, form.duration + 15));
    lines.push(
      `Create an approximately ${sec}-second ${genre} song in ${lang}. Mood: ${mood}.`,
      storyNote,
      `Story hook: ${concept}.`,
      "Use clear structure: intro, verse, chorus, bridge or verse 2, outro.",
    );
  }

  if (form.artistStyle?.trim()) {
    lines.push(`Style reference (original only, do not imitate a specific artist): ${form.artistStyle.trim()}.`);
  }

  if (instrumental) {
    lines.push("Instrumental only, no vocals.");
    if (sourceText.length > 40) {
      lines.push(
        "Reflect the emotional arc of this source material in the instrumental:",
        "",
        sourceText.slice(0, 4000),
      );
    }
  } else {
    const custom =
      script?.fullLyrics?.trim() ||
      (script ? sectionLyricsBlock(script) : null);
    if (custom) {
      lines.push(
        "Create the song with the following original lyrics adapted from the user's story (use section tags):",
        "",
        custom,
      );
    } else if (sourceText.length > 40) {
      lines.push(
        "Write original singable lyrics that tell this story. Do not use copyrighted song lyrics.",
        "",
        "--- SOURCE ---",
        sourceText.slice(0, 6000),
        "--- END SOURCE ---",
      );
    } else {
      lines.push(
        "Write original lyrics about the theme. Family-friendly, monetization-safe, no famous song references.",
      );
    }
  }

  lines.push("High-quality stereo mix suitable for a YouTube Short music video.");
  return lines.join("\n");
}

function parseLyriaResponse(
  parts: GeminiPart[],
  model: LyriaModelId,
): LyriaGenerateResult {
  const textParts: string[] = [];
  let audio: Buffer | null = null;
  let mimeType = "audio/mpeg";

  for (const part of parts) {
    if (part.text?.trim()) {
      textParts.push(part.text.trim());
    }
    if (part.inlineData?.data) {
      audio = Buffer.from(part.inlineData.data, "base64");
      if (part.inlineData.mimeType) mimeType = part.inlineData.mimeType;
    }
  }

  if (!audio?.length) {
    throw new Error(
      "Lyria returned no audio. The prompt may have been blocked or the model is unavailable on your API key.",
    );
  }

  const fullText = textParts.join("\n\n");
  let lyricsText = fullText;
  let structureText = "";

  const lyricsMatch = fullText.match(/(?:^|\n)Lyrics?:\s*\n([\s\S]*)/i);
  if (lyricsMatch?.[1]) lyricsText = lyricsMatch[1].trim();

  try {
    if (fullText.trim().startsWith("{")) {
      const json = JSON.parse(fullText) as {
        lyrics?: string;
        structure?: unknown;
        sections?: unknown;
      };
      if (typeof json.lyrics === "string") lyricsText = json.lyrics;
      if (json.structure != null) {
        structureText =
          typeof json.structure === "string"
            ? json.structure
            : JSON.stringify(json.structure, null, 2);
      }
    }
  } catch {
    /* plain text lyrics */
  }

  return {
    model,
    audio,
    mimeType,
    lyricsText: lyricsText || fullText,
    structureText,
  };
}

export async function generateLyriaMusic(
  project: Project,
  opts?: { instrumental?: boolean; model?: LyriaModelId },
): Promise<LyriaGenerateResult> {
  const model = opts?.model ?? resolveLyriaModel(project.form);
  const prompt = buildLyriaPrompt(project, opts);
  const key = geminiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["AUDIO", "TEXT"],
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Lyria API error: ${res.status} ${err.slice(0, 600)}`);
  }

  const body = (await res.json()) as {
    candidates?: { content?: { parts?: GeminiPart[] } }[];
  };
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  return parseLyriaResponse(parts, model);
}

export function extFromMime(mime: string): string {
  if (mime.includes("wav")) return ".wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return ".mp3";
  return ".mp3";
}
