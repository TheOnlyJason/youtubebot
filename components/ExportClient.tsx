"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Project } from "@/types";

export function ExportClient({ initialProject }: { initialProject: Project }) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    const res = await fetch(`/api/projects/${project.id}`);
    const data = await res.json();
    if (res.ok) setProject(data.project);
  }

  async function post(kind: "script" | "render") {
    setBusy(kind);
    setErr(null);
    try {
      const path =
        kind === "script"
          ? `/api/projects/${project.id}/script`
          : `/api/projects/${project.id}/render`;
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.reasons?.join("; ") || "Failed");
      setProject(data.project);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  const gs = project.generatedScript;
  const videoUrl = project.render.outputRelativePath
    ? `/api/projects/${project.id}/video`
    : null;

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `safeshorts-${project.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={`/projects/${project.id}`} className="text-sm text-[var(--accent)] hover:underline">
          ← Back to project
        </Link>
        {err && (
          <p className="mt-3 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm text-red-100">
            {err}
          </p>
        )}
        <h1 className="mt-4 text-2xl font-semibold text-white">Export</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Manual review is recommended before uploading to YouTube. This MVP does not auto-upload.
        </p>
      </div>

      {videoUrl && (
        <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
          <h2 className="text-sm font-medium text-white">Preview</h2>
          <video
            key={videoUrl}
            className="mt-3 aspect-[9/16] max-h-[520px] w-auto rounded-lg border border-[var(--card-border)] bg-black"
            src={videoUrl}
            controls
          />
          <a
            href={videoUrl}
            download={`safeshorts-${project.id}.mp4`}
            className="mt-3 inline-flex rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            Download MP4
          </a>
        </section>
      )}

      {gs && (
        <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 text-sm">
          <h2 className="text-sm font-medium text-white">Metadata</h2>
          <div className="mt-3 flex flex-col gap-2">
            <Row label="Title" value={gs.title} onCopy={() => copy(gs.title)} />
            <Row label="Description" value={gs.description} onCopy={() => copy(gs.description)} />
            <Row label="Hashtags" value={gs.hashtags.join(" ")} onCopy={() => copy(gs.hashtags.join(" "))} />
          </div>
        </section>
      )}

      <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
        <h2 className="text-sm font-medium text-white">Actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => post("script")}
            className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-40"
          >
            {busy === "script" ? "Working…" : "Regenerate script"}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={async () => {
              setBusy("captions");
              try {
                const res = await fetch(`/api/projects/${project.id}/captions`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: "{}",
                });
                const data = await res.json();
                if (res.ok) setProject(data.project);
              } finally {
                setBusy(null);
              }
            }}
            className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-40"
          >
            {busy === "captions" ? "Working…" : "Regenerate captions"}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => post("render")}
            className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-40"
          >
            {busy === "render" ? "Rendering…" : "Re-render"}
          </button>
          <button
            type="button"
            onClick={downloadJson}
            className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm hover:bg-white/5"
          >
            Export project JSON
          </button>
          <button
            type="button"
            onClick={() => reload()}
            className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm hover:bg-white/5"
          >
            Refresh
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 text-sm text-emerald-100">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={project.exportApproved}
            onChange={async (e) => {
              const res = await fetch(`/api/projects/${project.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ exportApproved: e.target.checked }),
              });
              const data = await res.json();
              if (res.ok) setProject(data.project);
            }}
          />
          <span>
            I have manually reviewed this Short and I am comfortable distributing it (marks pipeline as
            Approved when render is complete).
          </span>
        </label>
      </section>
    </div>
  );
}

function Row({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="rounded-lg bg-black/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--muted)]">{label}</span>
        <button type="button" onClick={onCopy} className="text-xs text-[var(--accent)] hover:underline">
          Copy
        </button>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">{value}</p>
    </div>
  );
}
