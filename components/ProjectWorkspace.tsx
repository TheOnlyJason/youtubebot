"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { fastModeEnabled } from "@/lib/config";
import { allScenesHaveMedia, sceneHasMediaPath, scenesMissingMedia } from "@/lib/sceneMedia";
import { canRender } from "@/lib/projectStatus";
import type { MotionEffect, Project, Scene } from "@/types";

export function ProjectWorkspace({ initialProject }: { initialProject: Project }) {
  const [project, setProject] = useState<Project>(initialProject);
  const projectRef = useRef(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lyriaInstrumental, setLyriaInstrumental] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/projects/${project.id}`);
    const data = await res.json();
    if (res.ok) setProject(data.project);
    return data.project as Project | undefined;
  }, [project.id]);

  const soraActive = project.visualGeneration?.active === true;
  const soraFailedMessage =
    project.visualGeneration?.active === false &&
    project.visualGeneration?.phase === "failed"
      ? project.visualGeneration.error
      : undefined;

  useEffect(() => {
    if (soraActive) {
      setBusy("sora");
      const tick = () => void refresh();
      tick();
      const id = window.setInterval(tick, 2500);
      return () => window.clearInterval(id);
    }
    setBusy((b) => (b === "sora" ? null : b));
    return undefined;
  }, [soraActive, refresh]);

  useEffect(() => {
    if (soraFailedMessage) setErr(soraFailedMessage);
  }, [soraFailedMessage]);

  const gate = useMemo(() => canRender(project), [project]);
  const isMusicLyrics =
    project.form.contentType === "music_lyrics" ||
    project.generatedScript?.contentType === "music_lyrics";
  const missingMediaScenes = useMemo(() => scenesMissingMedia(project), [project]);
  const hasAllSceneMedia = useMemo(() => allScenesHaveMedia(project), [project]);
  const missingSceneIndices = useMemo(() => scenesMissingMedia(project), [project]);
  const canRetryFailedScenes =
    missingSceneIndices.length > 0 && missingSceneIndices.length < 5;
  const fastMode = fastModeEnabled();

  function priorScenesReady(sceneIndex: number): boolean {
    for (let j = 0; j < sceneIndex; j++) {
      if (!sceneHasMediaPath(project.scenes[j]!)) return false;
    }
    return true;
  }

  async function patch(body: unknown) {
    setErr(null);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Save failed");
    setProject(data.project);
  }

  async function generateScript() {
    setBusy("script");
    setErr(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/script`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Script failed");
      setProject(data.project);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function regenerateCaptions() {
    setBusy("captions");
    setErr(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullScript: project.generatedScript?.fullVoiceoverScript,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Captions failed");
      setProject(data.project);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function generateLyriaSong(opts?: { adaptOnly?: boolean }) {
    setBusy(opts?.adaptOnly ? "adapt" : "lyria");
    setErr(null);
    try {
      if (opts?.adaptOnly) {
        const res = await fetch(`/api/projects/${project.id}/music`, { method: "PUT" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Adapt failed");
        setProject(data.project);
        return;
      }
      const res = await fetch(`/api/projects/${project.id}/music`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrumental: lyriaInstrumental,
          asPrimaryAudio: true,
          adaptFromSource: true,
          sourceText:
            project.form.sourceText?.trim() ||
            project.generatedScript?.sourceText?.trim() ||
            undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lyria failed");
      setProject(data.project);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function serverTts() {
    setBusy("tts");
    setErr(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/tts`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "TTS failed");
      setProject(data.project);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function generateVisuals(mode: "images" | "stock_video") {
    const busyKey = mode === "stock_video" ? "stock" : "visuals";
    setBusy(busyKey);
    setErr(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/visuals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Visual generation failed");
      setProject(data.project);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function stopSoraGeneration(force = false) {
    setErr(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/visuals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancel: true, force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not stop Sora");
      setProject(data.project);
      setBusy(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  }

  async function startSoraGeneration(opts?: { sceneIndex?: number; retryFailed?: boolean }) {
    if (project.scenes.length !== 5) return;
    setErr(null);
    setBusy("sora");
    try {
      const res = await fetch(`/api/projects/${project.id}/visuals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "sora",
          sceneIndex: opts?.sceneIndex,
          retryFailed: opts?.retryFailed === true ? true : undefined,
        }),
      });
      const data = await res.json();
      if (res.status === 409) throw new Error(data.error || "Sora already running");
      if (res.status === 202) {
        setProject(data.project);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Could not start Sora");
      setProject(data.project);
      setBusy(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
      setBusy(null);
    }
  }

  async function renderVideo() {
    setBusy("render");
    setErr(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/render`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setProject(data.project ?? project);
        throw new Error(data.error || data.reasons?.join("; ") || "Render blocked");
      }
      setProject(data.project);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  function speakPreview() {
    if (!project.generatedScript?.fullVoiceoverScript || typeof window === "undefined") return;
    const u = new SpeechSynthesisUtterance(project.generatedScript.fullVoiceoverScript);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  async function uploadFile(kind: "voice" | "music" | "scene", file: File, sceneIndex?: number) {
    setBusy("upload");
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("projectId", project.id);
      fd.set("kind", kind === "scene" ? "scene" : kind);
      if (sceneIndex != null) fd.set("sceneIndex", String(sceneIndex));
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (kind === "voice") {
        await patch({
          voiceover: {
            mode: "upload",
            fileRelativePath: data.relativePath,
          },
        });
      } else if (kind === "music") {
        await patch({
          music: {
            ...projectRef.current.music,
            fileRelativePath: data.relativePath,
            rightsConfirmed: false,
          },
        });
      } else if (sceneIndex != null) {
        const scenes = [...projectRef.current.scenes];
        const s = scenes[sceneIndex];
        if (!s) return;
        scenes[sceneIndex] = {
          ...s,
          media: {
            sourceType: "upload",
            fileRelativePath: data.relativePath,
            mimeType: file.type,
          },
        };
        await patch({ scenes });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function updateScene(i: number, partial: Partial<Scene>) {
    const scenes = projectRef.current.scenes.map((s, idx) =>
      idx === i ? { ...s, ...partial } : s,
    );
    await patch({ scenes });
  }

  const safety = project.safetyReport;
  const checklist = project.renderChecklist;

  return (
    <div className="flex flex-col gap-8 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Project</p>
          <h1 className="text-2xl font-semibold text-white">
            {project.generatedScript?.title || project.form.topic || "Untitled"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StatusBadge project={project} />
            <Link
              href={`/projects/${project.id}/export`}
              className="text-sm text-[var(--accent)] hover:underline"
            >
              Export & YouTube prep
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          className="rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white"
        >
          Refresh
        </button>
      </div>

      {err && (
        <div className="rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2 text-sm text-red-100">
          {err}
        </div>
      )}

      <Step
        title={isMusicLyrics ? "1 · Your story" : "1 · Skit script"}
        description={
          isMusicLyrics
            ? "Paste or edit the message thread or Reddit post. Step 2 turns it into a full song."
            : "Generate a 5-beat comedy skit from your prompt — same cast and setting every scene."
        }
      >
        {isMusicLyrics && (
          <div className="mb-4 flex flex-col gap-3">
            <label className="text-xs text-[var(--muted)]">
              Source type
              <select
                className="mt-1 w-full rounded-lg border border-[var(--card-border)] bg-black/40 px-2 py-2 text-sm text-white"
                value={project.form.lyricSourceKind ?? "reddit"}
                onChange={(e) =>
                  patch({
                    form: {
                      ...projectRef.current.form,
                      lyricSourceKind: e.target.value as "messages" | "reddit",
                    },
                  })
                }
              >
                <option value="reddit">Reddit story</option>
                <option value="messages">Text messages</option>
              </select>
            </label>
            <label className="text-xs text-[var(--muted)]">
              Story or chat (your input)
              <textarea
                className="mt-1 min-h-[180px] w-full rounded-lg border border-[var(--card-border)] bg-black/40 p-3 text-sm text-white"
                value={
                  project.form.sourceText ??
                  project.generatedScript?.sourceText ??
                  project.form.topic
                }
                onChange={(e) =>
                  setProject({
                    ...project,
                    form: { ...project.form, sourceText: e.target.value },
                  })
                }
                onBlur={() =>
                  patch({
                    form: {
                      ...projectRef.current.form,
                      sourceText: projectRef.current.form.sourceText,
                    },
                  })
                }
              />
            </label>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {isMusicLyrics ? (
            <>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => generateLyriaSong({ adaptOnly: true })}
                className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-40"
              >
                {busy === "adapt" ? "Adapting…" : "Preview adapted lyrics only"}
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={generateScript}
                className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-40"
              >
                {busy === "script" ? "Adapting…" : "Re-adapt lyrics for visuals"}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={!!busy}
              onClick={generateScript}
              className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-40"
            >
              {busy === "script" ? "Generating…" : "Generate skit script"}
            </button>
          )}
          <button
            type="button"
            disabled={!project.generatedScript || !!busy}
            onClick={regenerateCaptions}
            className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-40"
          >
            {busy === "captions" ? "Updating…" : "Regenerate captions from script"}
          </button>
        </div>
        {project.topicKeywordWarnings && project.topicKeywordWarnings.length > 0 && (
          <p className="mt-3 rounded-lg border border-amber-700/40 bg-amber-950/25 px-3 py-2 text-xs text-amber-100">
            Topic keywords to double-check: {project.topicKeywordWarnings.join(", ")}
          </p>
        )}
        {safety && (
          <div
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
              safety.overall === "low"
                ? "border-emerald-800/50 bg-emerald-950/30 text-emerald-100"
                : safety.overall === "review"
                  ? "border-amber-800/50 bg-amber-950/30 text-amber-100"
                  : "border-red-800/60 bg-red-950/40 text-red-100"
            }`}
          >
            <p className="font-medium">
              Safety:{" "}
              {safety.overall === "low"
                ? "Low risk"
                : safety.overall === "review"
                  ? "Review needed"
                  : "Do not render until fixed"}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs opacity-95">
              {safety.findings.map((f) => (
                <li key={f.code + f.message}>{f.message}</li>
              ))}
            </ul>
          </div>
        )}
        {project.generatedScript && (
          <div className="mt-4 flex flex-col gap-3">
            <label className="text-xs text-[var(--muted)]">
              {isMusicLyrics ? "Full lyrics (voiceover / captions)" : "Full voiceover script"}
              <textarea
                className="mt-1 min-h-[160px] w-full rounded-lg border border-[var(--card-border)] bg-black/40 p-3 text-sm text-white"
                value={project.generatedScript.fullVoiceoverScript}
                onChange={(e) =>
                  setProject({
                    ...project,
                    generatedScript: {
                      ...project.generatedScript!,
                      fullVoiceoverScript: e.target.value,
                    },
                  })
                }
                onBlur={() =>
                  patch({
                    generatedScript: projectRef.current.generatedScript,
                  })
                }
              />
            </label>
            <div className="grid gap-3 text-xs text-[var(--muted)] sm:grid-cols-2">
              <div>
                <p className="font-medium text-white/90">Title</p>
                <p>{project.generatedScript.title}</p>
              </div>
              <div>
                <p className="font-medium text-white/90">Hashtags</p>
                <p>{project.generatedScript.hashtags.join(" ")}</p>
              </div>
              {project.generatedScript.castDescription && (
                <div className="sm:col-span-2">
                  <p className="font-medium text-white/90">Cast (locked)</p>
                  <p>{project.generatedScript.castDescription}</p>
                </div>
              )}
              {project.generatedScript.settingAndProps && (
                <div className="sm:col-span-2">
                  <p className="font-medium text-white/90">Setting & props (locked)</p>
                  <p>{project.generatedScript.settingAndProps}</p>
                </div>
              )}
              {isMusicLyrics && (
                <>
                  <div>
                    <p className="font-medium text-white/90">Genre</p>
                    <p>{project.generatedScript.genre ?? project.form.musicGenre ?? "—"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-white/90">Mood / BPM</p>
                    <p>
                      {project.generatedScript.mood ?? project.form.tone}
                      {project.generatedScript.bpm != null
                        ? ` · ${project.generatedScript.bpm} BPM`
                        : ""}
                    </p>
                  </div>
                  {project.generatedScript.primarySubject && (
                    <div className="sm:col-span-2">
                      <p className="font-medium text-white/90">Video subject (locked)</p>
                      <p>{project.generatedScript.primarySubject}</p>
                    </div>
                  )}
                  {project.generatedScript.primarySetting && (
                    <div className="sm:col-span-2">
                      <p className="font-medium text-white/90">Setting (locked)</p>
                      <p>{project.generatedScript.primarySetting}</p>
                    </div>
                  )}
                </>
              )}
            </div>
            {isMusicLyrics && project.generatedScript.lyricsSections && (
              <div className="mt-2 flex flex-col gap-3">
                <p className="text-xs font-medium text-white/90">Lyrics by section</p>
                {project.generatedScript.lyricsSections.map((section, i) => (
                  <div
                    key={`${section.label}-${i}`}
                    className="rounded-lg border border-[var(--card-border)] bg-black/30 p-3 text-xs"
                  >
                    <p className="font-medium text-[var(--accent)]">
                      Scene {i + 1} — {section.label}
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-white/90">
                      {section.lines.join("\n")}
                    </pre>
                    <p className="mt-2 text-zinc-300">
                      <span className="text-zinc-500">Visual: </span>
                      {section.visual}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {!isMusicLyrics && project.generatedScript.skitBeats && (
              <div className="mt-2 flex flex-col gap-3">
                <p className="text-xs font-medium text-white/90">Scene layout (story skit)</p>
                {project.generatedScript.skitBeats.map((beat, i) => (
                  <div
                    key={`${beat.label}-${i}`}
                    className="rounded-lg border border-[var(--card-border)] bg-black/30 p-3 text-xs"
                  >
                    <p className="font-medium text-[var(--accent)]">
                      Scene {i + 1} — {beat.label}
                    </p>
                    <p className="mt-2 text-zinc-400">
                      <span className="text-zinc-500">Story: </span>
                      {beat.action}
                    </p>
                    <p className="mt-1 text-white/90">
                      <span className="text-zinc-500">Line: </span>
                      {beat.dialogue}
                    </p>
                    <p className="mt-1 text-zinc-300">
                      <span className="text-zinc-500">Visual: </span>
                      {beat.visual}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Step>

      <Step
        title={isMusicLyrics ? "2 · Generate song" : "2 · Voiceover"}
        description={
          isMusicLyrics
            ? "Adapts your story into lyrics, then Lyria 3 sings it (44.1 kHz MP3). This is your main audio for the Short."
            : "Upload WAV/MP3, use OpenAI TTS if configured, or browser preview only."
        }
      >
        <div className="flex flex-wrap gap-2">
          {isMusicLyrics && (
            <>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => generateLyriaSong()}
                className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-40"
              >
                {busy === "lyria" ? "Creating song…" : "Generate song from story"}
              </button>
              <label className="flex items-center gap-2 rounded-lg border border-[var(--card-border)] px-3 py-2 text-xs text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={lyriaInstrumental}
                  onChange={(e) => setLyriaInstrumental(e.target.checked)}
                />
                Instrumental only
              </label>
            </>
          )}
          <label className="cursor-pointer rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm hover:bg-white/5">
            {isMusicLyrics ? "Upload song audio" : "Upload voiceover"}
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              disabled={!!busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadFile("voice", f);
                e.target.value = "";
              }}
            />
          </label>
          {!isMusicLyrics && (
            <button
              type="button"
              disabled={!project.generatedScript || !!busy}
              onClick={serverTts}
              className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15 disabled:opacity-40"
            >
              {busy === "tts" ? "Synthesizing…" : "Server TTS (OpenAI)"}
            </button>
          )}
          <button
            type="button"
            disabled={!project.generatedScript}
            onClick={speakPreview}
            className="rounded-lg border border-dashed border-[var(--card-border)] px-3 py-2 text-sm text-[var(--muted)] hover:text-white"
          >
            Browser preview (not for export)
          </button>
        </div>
        {project.voiceover.fileRelativePath && (
          <p className="mt-2 text-xs text-emerald-300">
            {isMusicLyrics ? "Song" : "Voice"} file: {project.voiceover.fileRelativePath}
            {project.voiceover.providerId ? ` · ${project.voiceover.providerId}` : ""}
          </p>
        )}
        {isMusicLyrics && project.voiceover.providerId?.startsWith("lyria") && (
          <p className="mt-1 text-xs text-zinc-500">
            Lyria output includes SynthID watermark. Skip OpenAI TTS for music shorts — use this
            track as your main audio.
          </p>
        )}
        <label className="mt-3 flex items-center gap-2 text-xs text-[var(--muted)]">
          <span>Voice volume in mix</span>
          <input
            type="range"
            min={0}
            max={200}
            value={Math.round(project.voiceVolume * 100)}
            onChange={(e) =>
              setProject({ ...project, voiceVolume: Number(e.target.value) / 100 })
            }
            onMouseUp={() => patch({ voiceVolume: project.voiceVolume })}
            onTouchEnd={() => patch({ voiceVolume: project.voiceVolume })}
          />
        </label>
      </Step>

      <Step
        title="3 · Visuals (5 scenes)"
        description="Sora runs one scene at a time — scene 2 starts only after scene 1 finishes. Upload, Sora, DALL·E, or Pexels."
      >
        <p className="mb-3 text-xs text-zinc-400">
          Full Sora run: scene 1 → 2 → 3 → 4 → 5 in order (several minutes each). Do not start a later
          scene until earlier ones show a video file below.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => startSoraGeneration()}
            disabled={
              !project.generatedScript ||
              project.scenes.length !== 5 ||
              !!busy ||
              project.visualGeneration?.active
            }
            className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-40"
          >
            {project.visualGeneration?.active || busy === "sora"
              ? "Sora generating…"
              : "Generate Sora video (OpenAI)"}
          </button>
          {(canRetryFailedScenes ||
            (missingSceneIndices.length > 0 &&
              project.visualGeneration?.phase === "failed")) && (
            <button
              type="button"
              onClick={() => startSoraGeneration({ retryFailed: true })}
              disabled={
                !project.generatedScript ||
                project.scenes.length !== 5 ||
                !!busy ||
                project.visualGeneration?.active ||
                missingSceneIndices.length === 0
              }
              className="rounded-lg border border-amber-500/50 bg-amber-950/50 px-3 py-2 text-sm font-medium text-amber-100 hover:bg-amber-900/50 disabled:opacity-40"
            >
              Regenerate missing scenes (
              {missingSceneIndices.map((i) => i + 1).join(", ")})
            </button>
          )}
          <button
            type="button"
            disabled={!project.generatedScript || project.scenes.length !== 5 || !!busy}
            onClick={() => generateVisuals("images")}
            className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-40"
          >
            {busy === "visuals" ? "Generating images…" : "AI stills (DALL·E)"}
          </button>
          <button
            type="button"
            disabled={!project.generatedScript || project.scenes.length !== 5 || !!busy}
            onClick={() => generateVisuals("stock_video")}
            className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-40"
          >
            {busy === "stock" ? "Fetching clips…" : "Fetch stock video (Pexels)"}
          </button>
        </div>
        {!hasAllSceneMedia && project.scenes.length === 5 && !project.visualGeneration?.active && (
          <p className="mb-3 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
            Render does <strong>not</strong> run Sora automatically. Click{" "}
            <strong>Generate Sora video</strong> below first (or upload clips). Until each scene has a
            file, export uses solid color placeholders only.
          </p>
        )}
        {project.visualGeneration?.active && (
          <div className="mb-4 rounded-lg border border-indigo-500/30 bg-indigo-950/30 p-4">
            <div className="mb-2 flex items-center justify-between gap-2 text-sm text-indigo-100">
              <span className="min-w-0 flex-1">
                {project.visualGeneration.message ?? "Generating with Sora…"}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="tabular-nums font-medium">
                  {Math.round(project.visualGeneration.progress)}%
                </span>
                {project.visualGeneration.cancelRequested ? (
                  <button
                    type="button"
                    onClick={() => void stopSoraGeneration(true)}
                    className="rounded border border-amber-400/50 bg-amber-950/60 px-2 py-0.5 text-xs font-medium text-amber-100 hover:bg-amber-900/60"
                  >
                    Force stop
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void stopSoraGeneration(false)}
                    className="rounded border border-red-400/50 bg-red-950/60 px-2 py-0.5 text-xs font-medium text-red-100 hover:bg-red-900/60"
                  >
                    Stop
                  </button>
                )}
              </div>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-indigo-500 transition-[width] duration-500 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, project.visualGeneration.progress))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-indigo-200/80">
              {project.visualGeneration.message ??
                `Scene ${project.visualGeneration.sceneIndex + 1} · ${project.visualGeneration.phase}`}
              . sora-2 (720p) is faster than pro; still often several minutes per scene.
            </p>
          </div>
        )}
        {project.visualGeneration?.phase === "cancelled" && (
          <p className="mb-3 rounded-lg border border-zinc-500/40 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200">
            {project.visualGeneration.message ??
              "Sora stopped. Completed scenes are kept — use Regenerate missing scenes to continue."}
          </p>
        )}
        {project.visualGeneration?.phase === "failed" && project.visualGeneration.error && (
          <p className="mb-3 whitespace-pre-wrap rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-100">
            {project.visualGeneration.error}
          </p>
        )}
        {project.visualContinuity && (
          <p className="mb-3 rounded border border-[var(--card-border)] bg-black/20 px-3 py-2 text-xs text-zinc-300">
            <strong className="text-white">Visual continuity:</strong>{" "}
            {project.visualContinuity.palette}. {project.visualContinuity.lighting}. Scenes are
            generated to match the same setting; render uses soft crossfades between clips.
          </p>
        )}
        <p className="mb-3 text-xs text-[var(--muted)]">
          Regenerate the script to refresh continuity. Sora runs scene-by-scene with the same look;
          use <code className="text-zinc-300">sora-2</code> in .env for faster drafts.
        </p>
        {project.scenes.length === 0 && (
          <p className="text-sm text-[var(--muted)]">Generate a script to auto-build scenes.</p>
        )}
        <div className="flex flex-col gap-4">
          {project.scenes.map((scene, i) => (
            <div
              key={scene.id}
              className="rounded-lg border border-[var(--card-border)] bg-black/25 p-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-white capitalize">
                  Scene {i + 1} · {scene.kind}
                </p>
                <label className="cursor-pointer text-xs text-[var(--accent)] hover:underline">
                  Upload image/video
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    disabled={!!busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadFile("scene", f, i);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <label className="mt-1 block text-xs text-[var(--muted)]">
                Visual (Sora / DALL·E) — avoid phones, jealousy, montages
                <textarea
                  className="mt-1 w-full rounded border border-[var(--card-border)] bg-black/40 p-2 text-xs text-white"
                  rows={2}
                  value={scene.visualSuggestion ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setProject({
                      ...project,
                      scenes: project.scenes.map((s, idx) =>
                        idx === i ? { ...s, visualSuggestion: v } : s,
                      ),
                    });
                  }}
                  onBlur={(e) => updateScene(i, { visualSuggestion: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="mt-2 rounded border border-[var(--card-border)] px-2 py-1 text-xs hover:bg-white/5 disabled:opacity-40"
                disabled={
                  !project.generatedScript ||
                  !!busy ||
                  project.visualGeneration?.active ||
                  !priorScenesReady(i)
                }
                title={
                  !priorScenesReady(i)
                    ? `Finish scene(s) ${Array.from({ length: i }, (_, j) => j + 1).join(", ")} first`
                    : undefined
                }
                onClick={() => startSoraGeneration({ sceneIndex: i })}
              >
                Sora — this scene only
              </button>
              <label className="mt-2 block text-xs text-[var(--muted)]">
                On-screen caption
                <textarea
                  className="mt-1 w-full rounded border border-[var(--card-border)] bg-black/40 p-2 text-xs text-white"
                  rows={2}
                  value={scene.caption}
                  onChange={(e) => {
                    const v = e.target.value;
                    setProject({
                      ...project,
                      scenes: project.scenes.map((s, idx) =>
                        idx === i ? { ...s, caption: v } : s,
                      ),
                    });
                  }}
                  onBlur={(e) => updateScene(i, { caption: e.target.value })}
                />
              </label>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <label className="text-xs text-[var(--muted)]">
                  Seconds
                  <input
                    type="number"
                    min={1}
                    className="mt-1 w-full rounded border border-[var(--card-border)] bg-black/40 px-2 py-1 text-xs text-white"
                    value={scene.durationSeconds}
                    onChange={(e) =>
                      updateScene(i, { durationSeconds: Number(e.target.value) || 1 })
                    }
                  />
                </label>
                <label className="text-xs text-[var(--muted)]">
                  Motion
                  <select
                    className="mt-1 w-full rounded border border-[var(--card-border)] bg-black/40 px-2 py-1 text-xs text-white"
                    value={scene.motion}
                    onChange={(e) =>
                      updateScene(i, { motion: e.target.value as MotionEffect })
                    }
                  >
                    {(["none", "zoom_in", "pan", "fade"] as MotionEffect[]).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-[var(--muted)]">
                  Source
                  <select
                    className="mt-1 w-full rounded border border-[var(--card-border)] bg-black/40 px-2 py-1 text-xs text-white"
                    value={scene.media.sourceType}
                    onChange={(e) =>
                      updateScene(i, {
                        media: {
                          ...scene.media,
                          sourceType: e.target.value as Scene["media"]["sourceType"],
                          fileRelativePath:
                            e.target.value === "upload" ? scene.media.fileRelativePath : undefined,
                        },
                      })
                    }
                  >
                    <option value="animated_bg">Animated background</option>
                    <option value="placeholder">Placeholder</option>
                    <option value="upload">Upload</option>
                  </select>
                </label>
              </div>
              {scene.media.fileRelativePath ? (
                <p className="mt-2 text-[10px] text-emerald-400">
                  ✓ {scene.media.fileRelativePath}
                </p>
              ) : (
                <p className="mt-2 text-[10px] text-amber-400">
                  No video/image — render will use a solid color for this scene
                </p>
              )}
            </div>
          ))}
        </div>
      </Step>

      <Step
        title="4 · Background music (optional)"
        description={
          isMusicLyrics
            ? "Optional extra bed under your Lyria song. Usually leave empty — Lyria is already full mix."
            : "Only use tracks you own or licensed. Separate confirmation required."
        }
      >
        {isMusicLyrics && (
          <button
            type="button"
            disabled={!!busy}
            onClick={async () => {
              setBusy("lyria");
              setErr(null);
              try {
                const res = await fetch(`/api/projects/${project.id}/music`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    instrumental: lyriaInstrumental,
                    asPrimaryAudio: false,
                  }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Lyria failed");
                setProject(data.project);
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Error");
              } finally {
                setBusy(null);
              }
            }}
            className="mb-3 rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-40"
          >
            {busy === "lyria" ? "Generating…" : "Generate instrumental bed (Lyria → background)"}
          </button>
        )}
        <label className="cursor-pointer rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm hover:bg-white/5">
          Upload music (MP3/WAV)
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            disabled={!!busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile("music", f);
              e.target.value = "";
            }}
          />
        </label>
        {project.music.fileRelativePath && (
          <div className="mt-3 space-y-2 text-xs">
            <p className="text-zinc-300">{project.music.fileRelativePath}</p>
            <label className="flex items-start gap-2 text-[var(--muted)]">
              <input
                type="checkbox"
                checked={project.music.rightsConfirmed}
                onChange={(e) =>
                  patch({
                    music: {
                      ...projectRef.current.music,
                      rightsConfirmed: e.target.checked,
                    },
                  })
                }
              />
              <span>I confirm I own this music or have a license to use it commercially.</span>
            </label>
            <label className="flex items-center gap-2 text-[var(--muted)]">
              Music level ({Math.round(project.musicVolume * 100)}% of voice peak)
              <input
                type="range"
                min={0}
                max={40}
                value={Math.round(project.musicVolume * 100)}
                onChange={(e) =>
                  setProject({ ...project, musicVolume: Number(e.target.value) / 100 })
                }
                onMouseUp={() => patch({ musicVolume: project.musicVolume })}
                onTouchEnd={() => patch({ musicVolume: project.musicVolume })}
              />
            </label>
          </div>
        )}
      </Step>

      <Step
        title={fastMode ? "5 · Render" : "5 · Rights & human review"}
        description={
          fastMode
            ? "Fast mode — review checklist skipped. You are still responsible for rights on uploads."
            : "Required before FFmpeg will run."
        }
      >
        {fastMode ? (
          <p className="mb-4 text-sm text-zinc-400">
            <code className="text-zinc-300">NEXT_PUBLIC_FAST_MODE=true</code> in{" "}
            <code className="text-zinc-300">.env.local</code> — rights and human review checkboxes
            are skipped.
          </p>
        ) : (
          <>
        <label className="flex items-start gap-2 text-sm text-[var(--muted)]">
          <input
            type="checkbox"
            checked={project.rights.allMediaRightsConfirmed}
            onChange={(e) =>
              patch({
                rights: {
                  ...projectRef.current.rights,
                  allMediaRightsConfirmed: e.target.checked,
                },
              })}
          />
          <span>I confirm I own or have commercial rights to all uploaded media.</span>
        </label>
        <div className="mt-4 grid gap-2 text-sm">
          {(
            [
              ["scriptOriginal", "Script is original"],
              ["voiceOriginalOrLicensed", "Voiceover is original or licensed"],
              ["visualsOriginalOrLicensed", "Visuals are original or licensed"],
              ["musicOriginalOrLicensed", "Music is original, licensed, or not used"],
              ["noThirdPartyClips", "No movie/TV/anime/sports/social clips used"],
              [
                "noCopyrightedSong",
                isMusicLyrics
                  ? "Lyrics are 100% original (not a cover or famous song)"
                  : "No copyrighted commercial song used",
              ],
              ["notSpammy", "Content is not repetitive spam"],
              [
                "disclosureNoted",
                "I understand realistic AI content may need disclosure on YouTube",
              ],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-start gap-2 text-[var(--muted)]">
              <input
                type="checkbox"
                checked={checklist[key]}
                onChange={(e) =>
                  patch({
                    renderChecklist: {
                      ...projectRef.current.renderChecklist,
                      [key]: e.target.checked,
                    },
                  })
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
          </>
        )}
        {!gate.ok && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-200/90">
            {gate.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        <button
          type="button"
          disabled={!gate.ok || busy === "render" || project.render.status === "running"}
          onClick={renderVideo}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          {busy === "render" || project.render.status === "running"
            ? "Rendering…"
            : "Render vertical MP4"}
        </button>
        {project.render.message && (
          <p className="mt-2 text-xs text-zinc-400">{project.render.message}</p>
        )}
      </Step>
    </div>
  );
}

function Step({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}
