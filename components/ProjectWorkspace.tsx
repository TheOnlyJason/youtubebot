"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
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

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/projects/${project.id}`);
    const data = await res.json();
    if (res.ok) setProject(data.project);
  }, [project.id]);

  const gate = useMemo(() => canRender(project), [project]);

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

      <Step title="1 · Script" description="Generate an original script, edit it, and review safety flags.">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={generateScript}
            className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-40"
          >
            {busy === "script" ? "Generating…" : "Generate script"}
          </button>
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
              Full voiceover script
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
            </div>
          </div>
        )}
      </Step>

      <Step title="2 · Voiceover" description="Upload WAV/MP3, use OpenAI TTS if configured, or browser preview only.">
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm hover:bg-white/5">
            Upload voiceover
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
          <button
            type="button"
            disabled={!project.generatedScript || !!busy}
            onClick={serverTts}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15 disabled:opacity-40"
          >
            {busy === "tts" ? "Synthesizing…" : "Server TTS (OpenAI)"}
          </button>
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
            Voice file: {project.voiceover.fileRelativePath}
            {project.voiceover.providerId ? ` · ${project.voiceover.providerId}` : ""}
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

      <Step title="3 · Visuals (5 scenes)" description="Hook, three points, ending. Upload your own media or use built-in animated backgrounds.">
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
              <p className="mt-1 text-xs text-[var(--muted)]">{scene.visualSuggestion}</p>
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
              {scene.media.fileRelativePath && (
                <p className="mt-2 text-[10px] text-zinc-400">{scene.media.fileRelativePath}</p>
              )}
            </div>
          ))}
        </div>
      </Step>

      <Step title="4 · Background music (optional)" description="Only use tracks you own or licensed. Separate confirmation required.">
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

      <Step title="5 · Rights & human review" description="Required before FFmpeg will run.">
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
              ["noCopyrightedSong", "No copyrighted commercial song used"],
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
            ? "Rendering… (FFmpeg)"
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
