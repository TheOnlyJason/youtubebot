"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { scanTopicForRiskyKeywords } from "@/lib/safety/checker";
import type {
  ContentType,
  CtaType,
  LyricSourceKind,
  LyriaModelId,
  MusicGenre,
  Niche,
  ShortDuration,
  Tone,
  VisualStyle,
  VoiceStyle,
} from "@/types";
import { defaultTitleFromSource } from "@/lib/ai/sourceText";

const niches: Niche[] = [
  "facts",
  "motivation",
  "history",
  "tech tips",
  "finance basics",
  "productivity",
  "language learning",
  "health basics",
  "other",
];

const musicGenres: MusicGenre[] = [
  "pop",
  "hip-hop",
  "country",
  "r&b",
  "rock",
  "indie",
  "electronic",
  "other",
];

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [contentType, setContentType] = useState<ContentType>("skit");
  const [topic, setTopic] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [lyricSourceKind, setLyricSourceKind] = useState<LyricSourceKind>("reddit");
  const [musicGenre, setMusicGenre] = useState<MusicGenre>("pop");
  const [artistStyle, setArtistStyle] = useState("");
  const [lyriaModel, setLyriaModel] = useState<LyriaModelId | "auto">("auto");
  const [niche, setNiche] = useState<Niche>("other");
  const [tone, setTone] = useState<Tone>("funny");
  const [duration, setDuration] = useState<ShortDuration>(30);
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>("calm");
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("realistic");
  const [cta, setCta] = useState<CtaType>("subscribe");
  const [targetAudience, setTargetAudience] = useState("curious beginners");
  const [language, setLanguage] = useState("English");
  const [kw, setKw] = useState<string[]>([]);

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form: {
            contentType,
            topic:
              contentType === "music_lyrics"
                ? topic.trim() || defaultTitleFromSource(sourceText)
                : topic,
            ...(contentType === "music_lyrics"
              ? { sourceText: sourceText.trim(), lyricSourceKind }
              : {}),
            niche,
            tone,
            duration,
            voiceStyle,
            visualStyle,
            cta,
            targetAudience,
            language,
            ...(contentType === "music_lyrics"
              ? {
                  musicGenre,
                  artistStyle: artistStyle.trim() || undefined,
                  ...(lyriaModel !== "auto" ? { lyriaModel } : {}),
                }
              : {}),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      router.push(`/projects/${data.project.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">New Short</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Comedy skit (OpenAI), or turn a text thread / Reddit story into a song with Lyria 3.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
        <Field label="Content type">
          <select
            className="w-full rounded-lg border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm text-white"
            value={contentType}
            onChange={(e) => setContentType(e.target.value as ContentType)}
          >
            <option value="skit">Comedy skit (OpenAI)</option>
            <option value="music_lyrics">Story → song (messages or Reddit)</option>
          </select>
        </Field>

        {contentType === "music_lyrics" ? (
          <>
            <Field label="Source type">
              <select
                className="w-full rounded-lg border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm text-white"
                value={lyricSourceKind}
                onChange={(e) => setLyricSourceKind(e.target.value as LyricSourceKind)}
              >
                <option value="reddit">Reddit story</option>
                <option value="messages">Text messages</option>
              </select>
            </Field>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Paste your story or chat</span>
              <textarea
                className="min-h-[200px] rounded-lg border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[var(--accent)]"
                value={sourceText}
                onChange={(e) => {
                  const v = e.target.value;
                  setSourceText(v);
                  setKw(scanTopicForRiskyKeywords(v));
                }}
                placeholder={
                  lyricSourceKind === "messages"
                    ? "Alex: hey are you coming?\nJordan: maybe\nAlex: it's been 2 hours..."
                    : "AITA for telling my roommate I was moving out after she replaced my shampoo with mayo?"
                }
              />
              <span className="text-xs text-zinc-500">
                Adapted into original lyrics, then Lyria 3 produces the full song. GEMINI_API_KEY
                required.
              </span>
            </label>
            <Field label="Project title (optional)">
              <input
                className="w-full rounded-lg border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm text-white"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Auto from first line if empty"
              />
            </Field>
          </>
        ) : (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Skit prompt</span>
            <input
              className="rounded-lg border border-[var(--card-border)] bg-black/30 px-3 py-2 text-white outline-none focus:border-[var(--accent)]"
              value={topic}
              onChange={(e) => {
                const v = e.target.value;
                setTopic(v);
                setKw(scanTopicForRiskyKeywords(v));
              }}
              placeholder="e.g. Skit 1 — Bath Bubble Betrayal"
            />
            <span className="text-xs text-zinc-500">
              OpenAI expands into 5 story beats: same cast and location, comedy skit.
            </span>
          </label>
        )}

        {contentType === "music_lyrics" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Genre">
              <select
                className="w-full rounded-lg border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm text-white"
                value={musicGenre}
                onChange={(e) => setMusicGenre(e.target.value as MusicGenre)}
              >
                {musicGenres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Style reference (optional)">
              <input
                className="w-full rounded-lg border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm text-white"
                value={artistStyle}
                onChange={(e) => setArtistStyle(e.target.value)}
                placeholder="e.g. upbeat 80s synth — mood only"
              />
            </Field>
            <Field label="Lyria model">
              <select
                className="w-full rounded-lg border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm text-white sm:col-span-2"
                value={lyriaModel}
                onChange={(e) => setLyriaModel(e.target.value as LyriaModelId | "auto")}
              >
                <option value="auto">Auto (Clip if ≤30s, else Pro)</option>
                <option value="lyria-3-clip-preview">Lyria 3 Clip — 30s</option>
                <option value="lyria-3-pro-preview">Lyria 3 Pro — full song</option>
              </select>
            </Field>
          </div>
        )}

        {kw.length > 0 && (
          <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
            <p className="font-medium text-amber-200">Copyright / reuse warning</p>
            <p className="mt-1 text-amber-100/90">
              Your topic contains phrases that often imply unlicensed third-party media:{" "}
              {kw.join(", ")}. SafeShorts is designed for original or fully licensed assets only.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Niche">
            <select
              className="w-full rounded-lg border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm text-white"
              value={niche}
              onChange={(e) => setNiche(e.target.value as Niche)}
            >
              {niches.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tone">
            <select
              className="w-full rounded-lg border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm text-white"
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
            >
              {(["friendly", "dramatic", "educational", "funny", "mysterious"] as Tone[]).map(
                (t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label="Duration (seconds)">
            <select
              className="w-full rounded-lg border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm text-white"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) as ShortDuration)}
            >
              {[20, 30, 45, 60].map((d) => (
                <option key={d} value={d}>
                  {d}s
                </option>
              ))}
            </select>
          </Field>
          <Field label="Voice style">
            <select
              className="w-full rounded-lg border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm text-white"
              value={voiceStyle}
              onChange={(e) => setVoiceStyle(e.target.value as VoiceStyle)}
            >
              {(["male", "female", "energetic", "calm", "documentary"] as VoiceStyle[]).map(
                (v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label="Visual style">
            <select
              className="w-full rounded-lg border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm text-white"
              value={visualStyle}
              onChange={(e) => setVisualStyle(e.target.value as VisualStyle)}
            >
              {(
                [
                  "realistic",
                  "animated",
                  "minimal",
                  "cinematic",
                  "stock-footage style",
                ] as VisualStyle[]
              ).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Call to action">
            <select
              className="w-full rounded-lg border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm text-white"
              value={cta}
              onChange={(e) => setCta(e.target.value as CtaType)}
            >
              {(["follow", "subscribe", "comment", "no CTA"] as CtaType[]).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Target audience">
          <input
            className="w-full rounded-lg border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm text-white"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
          />
        </Field>
        <Field label="Language">
          <input
            className="w-full rounded-lg border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm text-white"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          />
        </Field>

        <button
          type="button"
          disabled={
            loading ||
            (contentType === "music_lyrics" ? sourceText.trim().length < 20 : !topic.trim())
          }
          onClick={submit}
          className="mt-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-40"
        >
          {loading ? "Creating…" : "Create project"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
