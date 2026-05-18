import fs from "fs";
import path from "path";
import type { Project, Scene } from "@/types";
import { ensureDir, uploadsDir } from "@/lib/paths";

interface PexelsVideoFile {
  link: string;
  width: number;
  height: number;
  quality?: string;
}

interface PexelsVideo {
  video_files: PexelsVideoFile[];
}

interface PexelsSearchResponse {
  videos?: PexelsVideo[];
}

function pickVerticalFile(files: PexelsVideoFile[]): PexelsVideoFile | null {
  const sorted = [...files].sort((a, b) => b.height * b.width - a.height * a.width);
  const vertical = sorted.find((f) => f.height >= f.width && f.height >= 720);
  return vertical ?? sorted[0] ?? null;
}

async function searchPexelsVideo(query: string, apiKey: string): Promise<string | null> {
  const url = new URL("https://api.pexels.com/videos/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "5");
  url.searchParams.set("orientation", "portrait");

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Pexels search failed: ${res.status} ${t}`);
  }

  const data = (await res.json()) as PexelsSearchResponse;
  for (const video of data.videos ?? []) {
    const file = pickVerticalFile(video.video_files ?? []);
    if (file?.link) return file.link;
  }
  return null;
}

async function downloadToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

export async function fetchStockVideoForScene(
  scene: Scene,
  sceneIndex: number,
  project: Project,
): Promise<{ relativePath: string; mimeType: string }> {
  const apiKey = process.env.PEXELS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "PEXELS_API_KEY is required for stock video clips. Get a free key at https://www.pexels.com/api/",
    );
  }

  const query =
    scene.visualSuggestion?.trim() ||
    `${project.form.topic} ${scene.caption}`.slice(0, 80);

  const link = await searchPexelsVideo(query, apiKey);
  if (!link) {
    throw new Error(`No Pexels video found for scene ${sceneIndex + 1}: "${query}"`);
  }

  const projectDir = path.join(uploadsDir(), "projects", project.id);
  ensureDir(projectDir);
  const filename = `scene_${sceneIndex}_stock.mp4`;
  const abs = path.join(projectDir, filename);
  await downloadToFile(link, abs);

  return {
    relativePath: path.join("uploads", "projects", project.id, filename).replace(/\\/g, "/"),
    mimeType: "video/mp4",
  };
}

export async function fetchAllSceneStockVideos(project: Project): Promise<Scene[]> {
  if (project.scenes.length !== 5) {
    throw new Error("Need exactly 5 scenes before fetching stock video.");
  }

  const updated: Scene[] = [];
  for (let i = 0; i < project.scenes.length; i++) {
    const scene = project.scenes[i];
    const file = await fetchStockVideoForScene(scene, i, project);
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
