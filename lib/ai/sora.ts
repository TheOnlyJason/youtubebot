import fs from "fs";
import path from "path";
import {
  finalizeVisualPrompt,
  isModerationBlockError,
  sanitizeVisualText,
} from "@/lib/ai/moderationSafe";
import { continuityPromptBlock } from "@/lib/visuals/continuity";
import type { Project, Scene, VisualContinuity, VisualStyle } from "@/types";
import { ensureDir, uploadsDir } from "@/lib/paths";

type SoraStatus = "queued" | "in_progress" | "completed" | "failed";

interface SoraVideoJob {
  id: string;
  status: SoraStatus;
  progress?: number;
  error?: { message?: string };
}

function openAiBase(): string {
  return (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
}

function openAiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is required for Sora video generation.");
  return key;
}

function soraModel(): string {
  return process.env.OPENAI_VIDEO_MODEL || "sora-2";
}

/** Sora supports 16s and 20s generations; we trim to scene length at render time. */
function soraSecondsForScene(durationSeconds: number): "16" | "20" {
  return durationSeconds > 16 ? "20" : "16";
}

function soraSize(): string {
  const model = soraModel();
  if (model.includes("pro")) return "1080x1920";
  return process.env.OPENAI_VIDEO_SIZE || "720x1280";
}

function styleDirective(visualStyle: VisualStyle): string {
  switch (visualStyle) {
    case "realistic":
    case "cinematic":
    case "stock-footage style":
      return "Photorealistic documentary B-roll, natural lighting, shallow depth of field.";
    case "animated":
      return "Polished motion graphics, modern educational Shorts style, not childish cartoon.";
    default:
      return "Clean, cinematic, photorealistic when showing real subjects.";
  }
}

export function buildSoraPrompt(
  scene: Scene,
  form: Project["form"],
  opts?: {
    continuity?: VisualContinuity;
    sceneIndex?: number;
    sceneCount?: number;
    priorSceneSummary?: string;
    primarySubject?: string;
    primarySetting?: string;
    castDescription?: string;
    settingAndProps?: string;
    /** Second attempt after moderation block */
    extraSoft?: boolean;
  },
): string {
  const action = sanitizeVisualText(
    scene.visualSuggestion?.trim() ||
      scene.caption ||
      `A scene about ${form.topic}`,
  );
  const subject = opts?.primarySubject?.trim() || form.topic;
  const setting = opts?.primarySetting?.trim() || "unchanged location";
  const parts = [
    styleDirective(form.visualStyle),
    `Topic: ${form.topic}. Tone: ${form.tone}.`,
    `Subject (same in every scene): ${subject}. Setting: ${setting}.`,
    opts?.castDescription
      ? `Cast bible (do not change): ${opts.castDescription}.`
      : "",
    opts?.settingAndProps
      ? `Setting and props (do not change): ${opts.settingAndProps}.`
      : "",
    `Shot: ${action}`,
    "Vertical 9:16 framing, smooth camera motion, leave lower third relatively clear for captions.",
    "No logos, watermarks, copyrighted characters, or recognizable public figures.",
  ];
  if (opts?.continuity != null && opts.sceneIndex != null && opts.sceneCount != null) {
    parts.push(
      continuityPromptBlock(
        opts.continuity,
        opts.sceneIndex,
        opts.sceneCount,
        opts.priorSceneSummary
          ? sanitizeVisualText(opts.priorSceneSummary)
          : undefined,
      ),
    );
  }
  return finalizeVisualPrompt(parts.join(" "), opts?.extraSoft === true);
}

async function createSoraJob(prompt: string, seconds: "16" | "20"): Promise<SoraVideoJob> {
  const res = await fetch(`${openAiBase()}/videos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: soraModel(),
      prompt,
      size: soraSize(),
      seconds,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sora create failed: ${res.status} ${err}`);
  }

  return (await res.json()) as SoraVideoJob;
}

async function retrieveSoraJob(videoId: string): Promise<SoraVideoJob> {
  const res = await fetch(`${openAiBase()}/videos/${videoId}`, {
    headers: { Authorization: `Bearer ${openAiKey()}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sora status failed: ${res.status} ${err}`);
  }
  return (await res.json()) as SoraVideoJob;
}

function pollConfig() {
  const maxWaitMs = Number(process.env.OPENAI_VIDEO_MAX_WAIT_MS) || 1_800_000; // 30 min
  const pollMs = Number(process.env.OPENAI_VIDEO_POLL_MS) || 10_000;
  return { maxWaitMs, pollMs };
}

export type SoraProgressUpdate = {
  phase: "queued" | "in_progress" | "completed" | "failed";
  progress: number;
};

async function pollSoraJob(
  videoId: string,
  opts?: {
    pollMs?: number;
    maxWaitMs?: number;
    label?: string;
    onProgress?: (u: SoraProgressUpdate) => void;
    shouldCancel?: () => void;
  },
): Promise<SoraVideoJob> {
  const defaults = pollConfig();
  const pollMs = opts?.pollMs ?? defaults.pollMs;
  const maxWaitMs = opts?.maxWaitMs ?? defaults.maxWaitMs;
  const started = Date.now();
  const label = opts?.label ?? videoId;

  while (Date.now() - started < maxWaitMs) {
    opts?.shouldCancel?.();
    const job = await retrieveSoraJob(videoId);
    const progress = job.progress ?? 0;
    opts?.onProgress?.({ phase: job.status, progress });
    if (job.status === "in_progress" || job.status === "queued") {
      console.info(
        `[sora] ${label}: ${job.status} ${progress}% (${Math.round((Date.now() - started) / 1000)}s elapsed)`,
      );
    }
    if (job.status === "completed") return job;
    if (job.status === "failed") {
      const msg = job.error?.message || "Sora video generation failed";
      if (isModerationBlockError(msg)) {
        throw new Error(
          `${msg} Try editing the scene visual under Script (avoid phones, jealousy, montages), then regenerate this scene only.`,
        );
      }
      throw new Error(msg);
    }
    const chunkMs = 1000;
    let waited = 0;
    while (waited < pollMs) {
      opts?.shouldCancel?.();
      const step = Math.min(chunkMs, pollMs - waited);
      await new Promise((r) => setTimeout(r, step));
      waited += step;
    }
  }

  const waitedMin = Math.round(maxWaitMs / 60_000);
  throw new Error(
    `Sora still processing after ${waitedMin} minutes. Try scene-by-scene, use OPENAI_VIDEO_MODEL=sora-2 for faster renders, or increase OPENAI_VIDEO_MAX_WAIT_MS.`,
  );
}

async function downloadSoraMp4(videoId: string, destAbs: string): Promise<void> {
  const res = await fetch(`${openAiBase()}/videos/${videoId}/content`, {
    headers: { Authorization: `Bearer ${openAiKey()}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sora download failed: ${res.status} ${err}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destAbs, buf);
}

export async function generateSceneSoraVideo(
  scene: Scene,
  sceneIndex: number,
  project: Project,
  genOpts?: {
    continuity?: VisualContinuity;
    priorSceneSummary?: string;
  },
  hooks?: {
    onCreating?: () => void;
    onProgress?: (progress: number) => void;
    onDownloading?: () => void;
    shouldCancel?: () => void;
  },
): Promise<{ relativePath: string; mimeType: string }> {
  const promptOpts = {
    continuity: genOpts?.continuity ?? project.visualContinuity,
    sceneIndex,
    sceneCount: 5,
    priorSceneSummary: genOpts?.priorSceneSummary,
    primarySubject: project.generatedScript?.primarySubject,
    primarySetting: project.generatedScript?.primarySetting,
    castDescription: project.generatedScript?.castDescription,
    settingAndProps: project.generatedScript?.settingAndProps,
  };

  const runOnce = async (extraSoft: boolean) => {
    hooks?.shouldCancel?.();
    const prompt = buildSoraPrompt(scene, project.form, { ...promptOpts, extraSoft });
    const seconds = soraSecondsForScene(scene.durationSeconds);
    hooks?.onCreating?.();
    hooks?.shouldCancel?.();
    const job = await createSoraJob(prompt, seconds);
    await pollSoraJob(job.id, {
      label: `scene ${sceneIndex + 1}${extraSoft ? " (soft retry)" : ""}`,
      onProgress: (u) => hooks?.onProgress?.(u.progress),
      shouldCancel: hooks?.shouldCancel,
    });
    return job;
  };

  let job: SoraVideoJob;
  try {
    job = await runOnce(false);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isModerationBlockError(msg)) throw e;
    console.warn(`[sora] scene ${sceneIndex + 1}: moderation block, retrying softened prompt`);
    job = await runOnce(true);
  }

  hooks?.shouldCancel?.();
  hooks?.onDownloading?.();

  const projectDir = path.join(uploadsDir(), "projects", project.id);
  ensureDir(projectDir);
  const filename = `scene_${sceneIndex}_sora.mp4`;
  const abs = path.join(projectDir, filename);
  await downloadSoraMp4(job.id, abs);

  return {
    relativePath: path.join("uploads", "projects", project.id, filename).replace(/\\/g, "/"),
    mimeType: "video/mp4",
  };
}

export async function generateAllSceneSoraVideos(project: Project): Promise<Scene[]> {
  if (project.scenes.length !== 5) {
    throw new Error("Need exactly 5 scenes before generating Sora video.");
  }

  const updated: Scene[] = [];
  for (let i = 0; i < project.scenes.length; i++) {
    const scene = project.scenes[i];
    const file = await generateSceneSoraVideo(scene, i, project);
    updated.push({
      ...scene,
      media: {
        sourceType: "upload",
        fileRelativePath: file.relativePath,
        mimeType: file.mimeType,
      },
    });
  }
  return updated;
}
