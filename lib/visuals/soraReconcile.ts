import { getProject, saveProject } from "@/lib/db";
import type { Project, VisualGenerationJob } from "@/types";

/** No DB updates while a run is active (poll patches) for this long → worker likely died */
const STALE_ACTIVE_MS = 3 * 60 * 1000;
/** Cancel requested but never cleared */
const STALE_CANCEL_MS = 2 * 60 * 1000;
/** Whole run older than this → zombie */
const MAX_RUN_MS = 40 * 60 * 1000;

function clearedJob(
  prev: VisualGenerationJob,
  patch: Partial<VisualGenerationJob>,
): VisualGenerationJob {
  return {
    ...prev,
    active: false,
    cancelRequested: false,
    ...patch,
  };
}

export function reconcileSoraVisualGeneration(project: Project): Project {
  const vg = project.visualGeneration;
  if (!vg?.active) return project;

  const now = Date.now();
  const updatedMs = Date.parse(project.updatedAt) || now;
  const startedMs = Date.parse(vg.startedAt) || updatedMs;
  const idleMs = now - updatedMs;
  const runMs = now - startedMs;

  if (vg.cancelRequested && idleMs > STALE_CANCEL_MS) {
    const next: Project = {
      ...project,
      visualGeneration: clearedJob(vg, {
        phase: "cancelled",
        message:
          "Stopped. Finished scenes are saved — use Regenerate missing scenes to continue.",
        finishedAt: new Date().toISOString(),
        error: undefined,
      }),
      updatedAt: new Date().toISOString(),
    };
    saveProject(next);
    return next;
  }

  if (runMs > MAX_RUN_MS || idleMs > STALE_ACTIVE_MS) {
    const next: Project = {
      ...project,
      visualGeneration: clearedJob(vg, {
        phase: "cancelled",
        message:
          "Sora run ended (timed out or app restarted). Completed scenes are kept — use Regenerate missing scenes.",
        finishedAt: new Date().toISOString(),
        error: undefined,
      }),
      updatedAt: new Date().toISOString(),
    };
    saveProject(next);
    return next;
  }

  return project;
}

/** Immediate UI recovery when Stop is stuck */
export function forceClearSoraGeneration(
  projectId: string,
): { ok: true; project: Project } | { ok: false; error: string } {
  const project = getProject(projectId);
  if (!project) return { ok: false, error: "Project not found" };
  if (!project.visualGeneration?.active) {
    return { ok: false, error: "Sora is not marked as running." };
  }

  const vg = project.visualGeneration;
  const next: Project = {
    ...project,
    visualGeneration: clearedJob(vg, {
      phase: vg.cancelRequested ? "cancelled" : "failed",
      message: vg.cancelRequested
        ? "Stopped. Finished scenes are saved — use Regenerate missing scenes to continue."
        : "Sora status reset. Retry missing scenes if needed.",
      finishedAt: new Date().toISOString(),
      error: undefined,
    }),
    updatedAt: new Date().toISOString(),
  };
  saveProject(next);
  return { ok: true, project: next };
}

export function reconcileProjectState(project: Project): Project {
  return reconcileSoraVisualGeneration(project);
}
