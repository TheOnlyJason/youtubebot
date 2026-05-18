"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { scanTopicForRiskyKeywords } from "@/lib/safety/checker";
import type { CtaType, Niche, ShortDuration, Tone, VisualStyle, VoiceStyle } from "@/types";

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

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState("");
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
            topic,
            niche,
            tone,
            duration,
            voiceStyle,
            visualStyle,
            cta,
            targetAudience,
            language,
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
        <h1 className="text-2xl font-semibold text-white">New skit Short</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Enter a skit title or idea. The script becomes five story beats (Setup → Button) with the
          same cast and setting in every scene — not a documentary.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
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
            AI expands this into 5 detailed scenes: same characters, same location, story comedy.
          </span>
        </label>
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
          disabled={loading || !topic.trim()}
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
