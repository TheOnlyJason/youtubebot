import type { TtsGenerateInput, TtsGenerateResult, TtsProvider } from "@/lib/tts/types";

/**
 * OpenAI TTS — add ElevenLabs/Google by implementing TtsProvider similarly
 * and registering in lib/tts/index.ts
 */
export class OpenAiTtsProvider implements TtsProvider {
  id = "openai_tts";

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async generate(input: TtsGenerateInput): Promise<TtsGenerateResult> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY not set");
    const model = process.env.OPENAI_TTS_MODEL || "tts-1";
    const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const voice = mapVoiceStyleToOpenAiVoice(input.voiceStyle);
    const res = await fetch(`${base.replace(/\/$/, "")}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice,
        input: input.text,
        format: "mp3",
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`OpenAI TTS failed: ${res.status} ${t}`);
    }
    const arrayBuf = await res.arrayBuffer();
    return {
      audioBuffer: Buffer.from(arrayBuf),
      extension: "mp3",
      providerId: this.id,
    };
  }
}

function mapVoiceStyleToOpenAiVoice(style: string): string {
  const s = style.toLowerCase();
  if (s.includes("female")) return "nova";
  if (s.includes("male")) return "onyx";
  if (s.includes("energetic")) return "shimmer";
  if (s.includes("calm")) return "alloy";
  if (s.includes("documentary")) return "echo";
  return "alloy";
}
