import type { TtsGenerateInput, TtsGenerateResult, TtsProvider } from "@/lib/tts/types";
import { OpenAiTtsProvider } from "@/lib/tts/openai";

const providers: TtsProvider[] = [new OpenAiTtsProvider()];

export function getConfiguredTtsProviders(): TtsProvider[] {
  return providers.filter((p) => p.isConfigured());
}

/**
 * Primary entry — tries providers in order; throws if none configured.
 * For MVP preview path, UI can use browser SpeechSynthesis instead of calling this.
 */
export async function generateVoiceover(
  scriptText: string,
  voiceStyle: string,
): Promise<TtsGenerateResult> {
  const input: TtsGenerateInput = { text: scriptText, voiceStyle };
  const configured = getConfiguredTtsProviders();
  if (!configured.length) {
    throw new Error(
      "No TTS provider configured. Set OPENAI_API_KEY or upload a voiceover file.",
    );
  }
  return configured[0].generate(input);
}

export type { TtsProvider, TtsGenerateResult };
