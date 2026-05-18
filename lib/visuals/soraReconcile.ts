import fs from "fs";
import { getProject, saveProject } from "@/lib/db";
import { absFromRelative } from "@/lib/paths";
import { scenesMissingUsableMedia } from "@/lib/sceneMedia.server";
import type { Project, VisualGenerationJob } from "@/types";

/** No runner heartbeat after cancel — background job likely died (dev server restart, etc.) */
const STALE_AFTER_CANCEL_MS = 90_000;

function formatSceneList(indices: number[]): string {
  return indices.map((i) => i + 1).join(", ");
}

function closedJob(
  prev: VisualGenerationJob,
  phase: VisualGenerationJob["phase"],
  message: string,
): VisualGenerationJob {
  return {
    ...prev,
    active: false,
    cancelRequested: false,
    phase,
    progress: phase === "completed" ? 100 : prev.progress,
    sceneProgress: phase === "completed" ? 100 : prev.sceneProgress,
    finishedAt: new Date().toISOString(),
    error: phase === "failed" ? message : undefined,
    message,
  };
}

/**
 * Fix zombie `visualGeneration.active` when the background runner stopped
 * (e.g. user clicked Stop then Next.js reloaded, or process crashed).
 */
export function reconcileVisualGeneration(project: Project): Project {
  const vg = project.visualGeneration;
  if (!vg?.active) return project;

  const missing = scenesMissingUsableMedia(project);
  const ageMs = Date.now() - Date.parse(project.updatedAt);

  if (missing.length === 0) {
    const next: Project = {
      ...project,
      visualGeneration: closedJob(
        vg,
        "completed",
        "All scenes complete",
      ),
    };
    saveProject(next);
    return next;
  }

  if (vg.cancelRequested && ageMs >= STALE_AFTER_CANCEL_MS) {
    const saved = 5 - missing.length;
    const message =
      saved > 0
        ? `Stopped. ${saved} scene(s) saved — use Regenerate missing scenes (${formatSceneList(missing)}).`
        : "Stopped before any scene finished.";
    const next: Project = {
      ...project,
      visualGeneration: closedJob(vg, "cancelled", message),
    };
    saveProject(next);
    return next;
  }

  return project;
}

export function forceResetVisualGeneration(
  projectId: string,
): { ok: true; project: Project } | { ok: false; error: string } {
  const raw = getProject(projectId);
  if (!raw) return { ok: false, error: "Project not found" };
  const project = reconcileVisualGeneration(raw);
  if (!project.visualGeneration?.active) {
    return { ok: true, project };
  }

  const vg = project.visualGeneration;
  const missing = scenesMissingUsableMedia(project);
  const message =
    missing.length === 0
      ? "All scenes complete"
      : missing.length === 5
        ? "Sora status cleared."
        : `Status cleared. Regenerate missing scenes (${formatSceneList(missing)}).`;

  const next: Project = {
    ...project,
    visualGeneration: closedJob(
      vg,
      missing.length === 0 ? "completed" : "cancelled",
      message,
    ),
  };
  saveProject(next);
  return { ok: true, project: next };
}

const STALE_RENDER_MS = 8 * 60 * 1000;

/** Clear zombie render.status = running after dev server restart */
export function reconcileRenderJob(project: Project): Project {
  if (project.render.status !== "running") return project;

  const outRel =
    project.render.outputRelativePath ??
    `renders/short_${project.id}.mp4`;
  try {
    if (fs.existsSync(absFromRelative(outRel))) {
      const next: Project = {
        ...project,
        render: {
          status: "done",
          message: "Render complete",
          outputRelativePath: outRel.replace(/\\/g, "/"),
          startedAt: project.render.startedAt,
          finishedAt: new Date().toISOString(),
        },
      };
      saveProject(next);
      return next;
    }
  } catch {
    /* ignore */
  }

  const started = Date.parse(project.render.startedAt ?? "0");
  if (Date.now() - started < STALE_RENDER_MS) return project;

  const next: Project = {
    ...project,
    render: {
      status: "error",
      message: "Render was interrupted (server restarted?). Click Render vertical MP4 again.",
      startedAt: project.render.startedAt,
      finishedAt: new Date().toISOString(),
    },
  };
  saveProject(next);
  return next;
}

export function reconcileProjectState(project: Project): Project {
  return reconcileRenderJob(reconcileVisualGeneration(project));
}
