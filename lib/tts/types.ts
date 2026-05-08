export interface TtsGenerateInput {
  text: string;
  voiceStyle: string;
}

export interface TtsGenerateResult {
  /** Bytes of audio file (WAV or MP3) */
  audioBuffer: Buffer;
  extension: "mp3" | "wav";
  providerId: string;
}

export interface TtsProvider {
  id: string;
  isConfigured(): boolean;
  generate(input: TtsGenerateInput): Promise<TtsGenerateResult>;
}
