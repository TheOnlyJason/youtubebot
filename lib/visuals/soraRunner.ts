import { getProject, saveProject } from "@/lib/db";
import { isModerationBlockError, moderationBlockUserHint } from "@/lib/ai/moderationSafe";
import { generateSceneSoraVideo } from "@/lib/ai/sora";
import { deriveVisualContinuity } from "@/lib/visuals/continuity";
import {
  assertSoraNotCancelled,
  isSoraGenerationCancelledError,
} from "@/lib/visuals/soraCancel";
import { reconcileVisualGeneration } from "@/lib/visuals/soraReconcile";
import { sceneHasUsableMedia, scenesMissingUsableMedia } from "@/lib/sceneMedia.server";
import type { Project, VisualGenerationJob } from "@/types";

export type StartSoraOptions = {
  sceneIndex?: number;
  sceneIndices?: number[];
  /** Only scenes without a usable media file on disk */
  retryFailed?: boolean;
};

function formatSceneList(indices: number[]): string {
  return indices.map((i) => i + 1).join(", ");
}

export function resolveSoraSceneIndices(
  project: Project,
  options?: number | StartSoraOptions,
): number[] | { error: string } {
  if (typeof options === "number") {
    if (options < 0 || options >= project.scenes.length) {
      return { error: "Invalid scene index." };
    }
    return [options];
  }

  const opts = options ?? {};

  if (opts.retryFailed) {
    const missing = scenesMissingUsableMedia(project);
    if (missing.length === 0) {
      return { error: "All scenes already have video files. Nothing to retry." };
    }
    return missing;
  }

  if (opts.sceneIndices?.length) {
    const unique = [...new Set(opts.sceneIndices)].filter(
      (i) => i >= 0 && i < project.scenes.length,
    );
    if (unique.length === 0) return { error: "No valid scene indices." };
    return unique.sort((a, b) => a - b);
  }

  if (opts.sceneIndex != null) {
    if (opts.sceneIndex < 0 || opts.sceneIndex >= project.scenes.length) {
      return { error: "Invalid scene index." };
    }
    return [opts.sceneIndex];
  }

  return [0, 1, 2, 3, 4].slice(0, project.scenes.length);
}

/** Scenes must complete in order: 1 → 2 → 3 … */
export function priorScenesHaveMedia(project: Project, sceneIndex: number): boolean {
  for (let i = 0; i < sceneIndex; i++) {
    if (!sceneHasUsableMedia(project.scenes[i]!)) return false;
  }
  return true;
}

function priorSummaryFromCompletedScenes(
  scenes: Project["scenes"],
  beforeIndex: number,
): string | undefined {
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const s = scenes[i];
    if (!sceneHasUsableMedia(s)) continue;
    const text = s.visualSuggestion?.trim() || s.caption?.trim();
    if (text) return text;
  }
  return undefined;
}

function overallProgress(sceneIndex: number, sceneCount: number, sceneProgress: number): number {
  const slice = 100 / sceneCount;
  return Math.min(100, Math.round(sceneIndex * slice + (sceneProgress / 100) * slice));
}

function patchVisualGen(
  projectId: string,
  patch: Partial<VisualGenerationJob> & { scenes?: Project["scenes"] },
): void {
  const p = getProject(projectId);
  if (!p) return;
  const { scenes, ...vgPatch } = patch;
  const prev = p.visualGeneration;
  const next: Project = {
    ...p,
    scenes: scenes ?? p.scenes,
    visualGeneration: prev
      ? { ...prev, ...vgPatch }
      : (vgPatch as VisualGenerationJob),
    updatedAt: new Date().toISOString(),
  };
  saveProject(next);
}

function finishVisualGen(
  projectId: string,
  opts?: { error?: string; cancelled?: boolean },
): void {
  const p = getProject(projectId);
  if (!p?.visualGeneration) return;
  const error = opts?.error;
  const cancelled = opts?.cancelled === true;
  saveProject({
    ...p,
    visualGeneration: {
      ...p.visualGeneration,
      active: false,
      cancelRequested: false,
      phase: cancelled ? "cancelled" : error ? "failed" : "completed",
      progress: cancelled || error ? p.visualGeneration.progress : 100,
      finishedAt: new Date().toISOString(),
      error: cancelled ? undefined : error,
      message: cancelled
        ? "Stopped. Finished scenes are saved — use Regenerate missing scenes to continue."
        : (error ?? "All scenes complete"),
    },
    updatedAt: new Date().toISOString(),
  });
}

export async function runSoraScenesBackground(
  projectId: string,
  sceneIndices: number[],
): Promise<void> {
  const project = getProject(projectId);
  if (!project || project.scenes.length !== 5) return;

  const sceneCount = sceneIndices.length;
  const continuity =
    project.visualContinuity ??
    deriveVisualContinuity(
      project.form,
      project.generatedScript?.sceneVisualSuggestions,
      {
        primarySubject: project.generatedScript?.primarySubject,
        primarySetting: project.generatedScript?.primarySetting,
        castDescription: project.generatedScript?.castDescription,
        settingAndProps: project.generatedScript?.settingAndProps,
      },
    );

  if (!project.visualContinuity) {
    saveProject({ ...project, visualContinuity: continuity });
  }

  try {
    let scenes = project.scenes;
    let priorSceneSummary = priorSummaryFromCompletedScenes(
      scenes,
      sceneIndices[0] ?? 0,
    );

    for (let runIdx = 0; runIdx < sceneIndices.length; runIdx++) {
      assertSoraNotCancelled(projectId);

      const sceneIndex = sceneIndices[runIdx];
      const scene = scenes[sceneIndex];
      if (!scene) continue;

      patchVisualGen(projectId, {
        active: true,
        mode: "sora",
        sceneIndex,
        sceneCount,
        phase: "creating",
        progress: overallProgress(runIdx, sceneCount, 0),
        sceneProgress: 0,
        message:
          sceneCount === 1
            ? `Scene ${sceneIndex + 1}: starting Sora…`
            : `Scene ${sceneIndex + 1} of ${sceneCount} (sequential) — starting…`,
        startedAt: project.visualGeneration?.startedAt ?? new Date().toISOString(),
        error: undefined,
      });

      const sceneStartedMs = Date.now();
      const file = await generateSceneSoraVideo(
        scene,
        sceneIndex,
        { ...project, scenes, visualContinuity: continuity },
        {
          continuity,
          priorSceneSummary,
        },
        {
        onCreating: () => {
          patchVisualGen(projectId, {
            phase: "creating",
            message: `Scene ${sceneIndex + 1}: submitting to OpenAI…`,
          });
        },
        onProgress: (sceneProgress) => {
          const current = getProject(projectId);
          const prev = current?.visualGeneration?.sceneProgress ?? 0;
          const smoothed = Math.max(prev, sceneProgress);
          const elapsedMin = Math.max(1, Math.round((Date.now() - sceneStartedMs) / 60_000));
          patchVisualGen(projectId, {
            phase: "rendering",
            sceneProgress: smoothed,
            progress: overallProgress(runIdx, sceneCount, smoothed),
            message:
              smoothed > 0
                ? `Scene ${sceneIndex + 1}: rendering ${smoothed}% (${elapsedMin} min)`
                : `Scene ${sceneIndex + 1}: waiting on OpenAI… (${elapsedMin} min — 0% is normal early on)`,
          });
        },
        onDownloading: () => {
          patchVisualGen(projectId, {
            phase: "downloading",
            sceneProgress: 100,
            progress: overallProgress(runIdx, sceneCount, 100),
            message: `Scene ${sceneIndex + 1}: downloading MP4…`,
          });
        },
        shouldCancel: () => assertSoraNotCancelled(projectId),
      },
      );

      priorSceneSummary =
        scene.visualSuggestion?.trim() || scene.caption || priorSceneSummary;

      scenes = scenes.map((s, i) =>
        i === sceneIndex
          ? {
              ...s,
              media: {
                sourceType: "upload" as const,
                fileRelativePath: file.relativePath,
                mimeType: file.mimeType,
              },
            }
          : s,
      );

      patchVisualGen(projectId, {
        scenes,
        progress: overallProgress(runIdx + 1, sceneCount, 0),
        message: `Scene ${sceneIndex + 1} complete`,
      });
    }

    finishVisualGen(projectId);
  } catch (e) {
    if (isSoraGenerationCancelledError(e)) {
      finishVisualGen(projectId, { cancelled: true });
      return;
    }
    const raw = e instanceof Error ? e.message : "Sora generation failed";
    const p = getProject(projectId);
    const sceneIdx = p?.visualGeneration?.sceneIndex;
    const message = isModerationBlockError(raw)
      ? `${raw}\n\n${moderationBlockUserHint(sceneIdx)}`
      : raw;
    patchVisualGen(projectId, {
      phase: "failed",
      message,
      error: message,
    });
    finishVisualGen(projectId, { error: message });
  }
}

/** Request stop — takes effect between scenes or within ~1s during polling */
export function requestStopSoraGeneration(
  projectId: string,
): { ok: true } | { ok: false; error: string } {
  let project = getProject(projectId);
  if (!project) return { ok: false, error: "Project not found" };
  project = reconcileVisualGeneration(project);
  if (!project.visualGeneration?.active) {
    return { ok: true };
  }
  if (project.visualGeneration.cancelRequested) {
    return { ok: true };
  }
  saveProject({
    ...project,
    visualGeneration: {
      ...project.visualGeneration,
      cancelRequested: true,
      message: "Stopping… (finishes current OpenAI step, then saves progress)",
    },
    updatedAt: new Date().toISOString(),
  });
  return { ok: true };
}

export function startSoraGeneration(
  projectId: string,
  options?: number | StartSoraOptions,
): { ok: true; sceneIndices: number[] } | { ok: false; error: string } {
  let project = getProject(projectId);
  if (!project) return { ok: false, error: "Project not found" };
  project = reconcileVisualGeneration(project);
  if (project.visualGeneration?.active) {
    return { ok: false, error: "Sora generation already in progress." };
  }

  const resolved = resolveSoraSceneIndices(project, options);
  if ("error" in resolved) return { ok: false, error: resolved.error };
  const indices = [...resolved].sort((a, b) => a - b);

  const isRetry = typeof options === "object" && options.retryFailed === true;
  const singleScene =
    typeof options === "number" ||
    (typeof options === "object" &&
      options.sceneIndex != null &&
      !options.retryFailed &&
      !options.sceneIndices?.length);

  if (singleScene && !isRetry) {
    const idx = indices[0]!;
    if (!priorScenesHaveMedia(project, idx)) {
      return {
        ok: false,
        error: `Finish scene(s) ${Array.from({ length: idx }, (_, i) => i + 1).join(", ")} before starting scene ${idx + 1}.`,
      };
    }
  }
  const startedAt = new Date().toISOString();
  const sceneLabel = formatSceneList(indices);
  saveProject({
    ...project,
    visualGeneration: {
      active: true,
      mode: "sora",
      sceneIndices: indices,
      sceneIndex: indices[0],
      sceneCount: indices.length,
      phase: "queued",
      progress: 0,
      sceneProgress: 0,
      message: isRetry
        ? `Retrying missing scene(s) ${sceneLabel} one at a time…`
        : indices.length === 5
          ? "Sora: scene 1 of 5 (each scene starts after the previous finishes)…"
          : `Sora: scene(s) ${sceneLabel} one at a time…`,
      startedAt,
      cancelRequested: false,
      error: undefined,
      finishedAt: undefined,
    },
    updatedAt: startedAt,
  });

  void runSoraScenesBackground(projectId, indices);
  return { ok: true, sceneIndices: indices };
}
