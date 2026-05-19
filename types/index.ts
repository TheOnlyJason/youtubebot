/** SafeShorts Studio — shared domain types */

export type ProjectStatus =
  | "Draft"
  | "Script Ready"
  | "Voice Ready"
  | "Visuals Ready"
  | "Rendering"
  | "Rendered"
  | "Approved";

export type Niche =
  | "facts"
  | "motivation"
  | "history"
  | "tech tips"
  | "finance basics"
  | "productivity"
  | "language learning"
  | "health basics"
  | "other";

export type Tone = "friendly" | "dramatic" | "educational" | "funny" | "mysterious";

export type ShortDuration = 20 | 30 | 45 | 60;

export type VoiceStyle =
  | "male"
  | "female"
  | "energetic"
  | "calm"
  | "documentary";

export type VisualStyle =
  | "realistic"
  | "animated"
  | "minimal"
  | "cinematic"
  | "stock-footage style";

export type CtaType = "follow" | "subscribe" | "comment" | "no CTA";

export type ContentType = "skit" | "music_lyrics";

/** Google Lyria 3 via Gemini API */
export type LyriaModelId = "lyria-3-clip-preview" | "lyria-3-pro-preview";

/** What the user pasted before we adapt it into a song */
export type LyricSourceKind = "messages" | "reddit";

export type MusicGenre =
  | "pop"
  | "hip-hop"
  | "country"
  | "r&b"
  | "rock"
  | "indie"
  | "electronic"
  | "other";

/** One section of original song lyrics (maps to a Short scene) */
export interface LyricSection {
  label: string;
  lines: string[];
  /** Music-video shot description for Sora */
  visual: string;
}

export type SceneKind =
  | "hook"
  | "point1"
  | "point2"
  | "point3"
  | "ending";

export type MotionEffect = "none" | "zoom_in" | "pan" | "fade";

export type VisualSourceType = "upload" | "placeholder" | "animated_bg";

export type SafetyLevel = "low" | "review" | "block";

export interface CaptionLine {
  text: string;
  /** Optional words to emphasize (simple substring match for UI / future ASS styles) */
  highlights?: string[];
}

/** One story beat in a 5-scene comedy skit */
export interface SkitSceneBeat {
  /** e.g. Setup, Complication, Escalation, Payoff, Button */
  label: string;
  /** What happens in the story (detailed, same cast throughout) */
  action: string;
  /** Spoken line for this scene — conversational, not documentary */
  dialogue: string;
  /** Detailed single-shot visual for Sora (same characters, setting, props) */
  visual: string;
}

export interface GeneratedScript {
  contentType?: ContentType;
  title: string;
  description: string;
  /** User skit prompt, e.g. "Skit 1 — Bath Bubble Betrayal" */
  skitConcept?: string;
  /** Music lyrics mode */
  songConcept?: string;
  genre?: string;
  mood?: string;
  bpm?: number;
  lyricsSections?: [
    LyricSection,
    LyricSection,
    LyricSection,
    LyricSection,
    LyricSection,
  ];
  fullLyrics?: string;
  /** Pasted DM thread or Reddit post */
  sourceText?: string;
  lyricSourceKind?: LyricSourceKind;
  /** Locked cast — identical in every scene (species, count, look, outfits) */
  castDescription?: string;
  /** Locked location + recurring props */
  settingAndProps?: string;
  /** One subject for the whole short — same in every scene */
  primarySubject: string;
  /** One location for the whole short */
  primarySetting: string;
  /** Five ordered story beats (preferred for new scripts) */
  skitBeats?: [
    SkitSceneBeat,
    SkitSceneBeat,
    SkitSceneBeat,
    SkitSceneBeat,
    SkitSceneBeat,
  ];
  hook: string;
  mainPoints: [string, string, string];
  ending: string;
  ctaLine: string;
  fullVoiceoverScript: string;
  captionLines: CaptionLine[];
  sceneVisualSuggestions: string[];
  hashtags: string[];
  estimatedDurationSeconds: number;
}

export interface SafetyFinding {
  code: string;
  message: string;
  level: SafetyLevel;
}

export interface SafetyReport {
  overall: SafetyLevel;
  findings: SafetyFinding[];
  keywordWarnings: string[];
}

export interface SceneMedia {
  sourceType: VisualSourceType;
  /** Relative path under /uploads from API (e.g. projects/abc/scene0.jpg) */
  fileRelativePath?: string;
  /** MIME hint for FFmpeg */
  mimeType?: string;
}

export interface Scene {
  id: string;
  kind: SceneKind;
  caption: string;
  durationSeconds: number;
  motion: MotionEffect;
  media: SceneMedia;
  visualSuggestion?: string;
}

export interface VoiceoverState {
  mode: "none" | "upload" | "tts_openai" | "tts_preview_note";
  /** Relative path under /uploads */
  fileRelativePath?: string;
  /** Which TTS provider produced the file (swap providers in lib/tts) */
  providerId?: string;
}

export interface MusicState {
  fileRelativePath?: string;
  /** User must confirm commercial rights */
  rightsConfirmed: boolean;
  volumePercent: number; // 0–100, voice uses separate control
  /** e.g. lyria-3-clip-preview when generated via Gemini */
  providerId?: string;
  /** Text parts returned alongside Lyria audio */
  generatedLyricsText?: string;
}

export interface RenderChecklist {
  scriptOriginal: boolean;
  voiceOriginalOrLicensed: boolean;
  visualsOriginalOrLicensed: boolean;
  musicOriginalOrLicensed: boolean;
  noThirdPartyClips: boolean;
  noCopyrightedSong: boolean;
  notSpammy: boolean;
  disclosureNoted: boolean;
}

export interface RightsConfirmation {
  /** Required before render: all uploaded media */
  allMediaRightsConfirmed: boolean;
}

export interface VisualContinuity {
  setting: string;
  lighting: string;
  palette: string;
  colorGrade: string;
  sceneBackgrounds: [string, string, string, string, string];
}

export interface ProjectForm {
  /** skit = comedy beats (OpenAI). music_lyrics = story → song (Gemini + Lyria) */
  contentType?: ContentType;
  niche: Niche;
  /** Short title; for music mode, source lives in sourceText */
  topic: string;
  /** Full pasted text messages or Reddit post */
  sourceText?: string;
  lyricSourceKind?: LyricSourceKind;
  tone: Tone;
  duration: ShortDuration;
  voiceStyle: VoiceStyle;
  visualStyle: VisualStyle;
  cta: CtaType;
  targetAudience: string;
  language: string;
  musicGenre?: MusicGenre;
  /** Optional vibe reference — must still be 100% original lyrics */
  artistStyle?: string;
  /** Lyria 3 model; auto-picks clip (30s) vs pro from duration if unset */
  lyriaModel?: LyriaModelId;
}

export interface RenderJob {
  status: "idle" | "running" | "done" | "error";
  message?: string;
  outputRelativePath?: string;
  startedAt?: string;
  finishedAt?: string;
}

export type VisualGenerationPhase =
  | "queued"
  | "creating"
  | "rendering"
  | "downloading"
  | "completed"
  | "failed"
  | "cancelled";

export interface VisualGenerationJob {
  active: boolean;
  mode: "sora";
  /** User clicked stop — finish current poll step, then exit */
  cancelRequested?: boolean;
  /** Scenes in this run (e.g. retry only missing clips) */
  sceneIndices?: number[];
  /** Scene currently generating (0–4) */
  sceneIndex: number;
  sceneCount: number;
  phase: VisualGenerationPhase;
  /** 0–100 overall across all scenes in this run */
  progress: number;
  /** 0–100 from OpenAI for the current scene */
  sceneProgress: number;
  message?: string;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

export interface Project {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
  form: ProjectForm;
  generatedScript?: GeneratedScript;
  safetyReport?: SafetyReport;
  /** Shared setting / palette so scenes match each other */
  visualContinuity?: VisualContinuity;
  scenes: Scene[];
  voiceover: VoiceoverState;
  music: MusicState;
  /** 0–1 voice gain in mix (default 1) */
  voiceVolume: number;
  /** 0–1 music gain in mix (default ~0.12) */
  musicVolume: number;
  renderChecklist: RenderChecklist;
  rights: RightsConfirmation;
  render: RenderJob;
  /** Live Sora / visual generation progress (polled by UI) */
  visualGeneration?: VisualGenerationJob;
  /** Manual approval for distribution / YouTube prep */
  exportApproved: boolean;
  /** Last known topic keywords for UI warnings */
  topicKeywordWarnings?: string[];
}

export interface ProjectsFile {
  projects: Project[];
}
