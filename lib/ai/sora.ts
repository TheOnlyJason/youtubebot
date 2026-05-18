import fs from "fs";
import path from "path";
import type { Project, Scene, VisualStyle } from "@/types";
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
  return process.env.OPENAI_VIDEO_MODEL || "sora-2-pro";
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

export function buildSoraPrompt(scene: Scene, form: Project["form"]): string {
  const action =
    scene.visualSuggestion?.trim() ||
    scene.caption ||
    `A scene about ${form.topic}`;
  return [
    styleDirective(form.visualStyle),
    `Topic: ${form.topic}. Tone: ${form.tone}.`,
    `Shot: ${action}`,
    "Vertical 9:16 framing, smooth camera motion, leave lower third relatively clear for captions.",
    "No logos, watermarks, copyrighted characters, or recognizable public figures.",
  ].join(" ");
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

async function pollSoraJob(
  videoId: string,
  opts?: { pollMs?: number; maxWaitMs?: number },
): Promise<SoraVideoJob> {
  const pollMs = opts?.pollMs ?? 15_000;
  const maxWaitMs = opts?.maxWaitMs ?? 600_000;
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    const job = await retrieveSoraJob(videoId);
    if (job.status === "completed") return job;
    if (job.status === "failed") {
      throw new Error(job.error?.message || "Sora video generation failed");
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  throw new Error("Sora video generation timed out (try again or generate one scene at a time).");
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
): Promise<{ relativePath: string; mimeType: string }> {
  const prompt = buildSoraPrompt(scene, project.form);
  const seconds = soraSecondsForScene(scene.durationSeconds);

  const job = await createSoraJob(prompt, seconds);
  await pollSoraJob(job.id);

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
