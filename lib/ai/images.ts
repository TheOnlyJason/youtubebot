import fs from "fs";
import path from "path";
import type { Project, Scene, VisualStyle } from "@/types";
import { ensureDir, uploadsDir } from "@/lib/paths";

function styleDirective(visualStyle: VisualStyle): string {
  switch (visualStyle) {
    case "realistic":
    case "cinematic":
    case "stock-footage style":
      return [
        "Photorealistic photograph or documentary B-roll frame.",
        "Natural lighting, shallow depth of field, professional camera look.",
        "No cartoon, no illustration, no anime, no 3D render, no clipart.",
      ].join(" ");
    case "animated":
      return [
        "Polished motion-design frame, modern flat or 3D motion graphics.",
        "Not childish cartoon; suitable for educational Shorts.",
      ].join(" ");
    case "minimal":
    default:
      return [
        "Clean, minimal composition with photographic realism when showing objects or people.",
        "Soft palette, uncluttered 9:16 frame. Avoid cartoon or illustration styles.",
      ].join(" ");
  }
}

function buildImagePrompt(scene: Scene, form: Project["form"]): string {
  const subject =
    scene.visualSuggestion?.trim() ||
    scene.caption ||
    `Scene for a ${form.niche} short about ${form.topic}`;
  return [
    styleDirective(form.visualStyle),
    `Topic context: ${form.topic}. Tone: ${form.tone}.`,
    `Visual: ${subject}`,
    "Vertical 9:16 safe composition with subject centered; leave lower third clear for captions.",
    "Original generic stock-style imagery only; no logos, watermarks, or recognizable celebrities.",
  ].join(" ");
}

export async function generateSceneImage(
  scene: Scene,
  sceneIndex: number,
  project: Project,
): Promise<{ relativePath: string; mimeType: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is required to generate AI scene images.");
  }

  const model = process.env.OPENAI_IMAGE_MODEL || "dall-e-3";
  const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const prompt = buildImagePrompt(scene, project.form);

  const res = await fetch(`${base.replace(/\/$/, "")}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: "1024x1792",
      quality: "hd",
      style: formUsesNaturalStyle(project.form.visualStyle) ? "natural" : "vivid",
      response_format: "b64_json",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Image API error (${sceneIndex + 1}): ${res.status} ${err}`);
  }

  const body = (await res.json()) as {
    data?: { b64_json?: string }[];
  };
  const b64 = body.data?.[0]?.b64_json;
  if (!b64) throw new Error(`Empty image response for scene ${sceneIndex + 1}`);

  const projectDir = path.join(uploadsDir(), "projects", project.id);
  ensureDir(projectDir);
  const filename = `scene_${sceneIndex}_ai.png`;
  const abs = path.join(projectDir, filename);
  fs.writeFileSync(abs, Buffer.from(b64, "base64"));

  return {
    relativePath: path.join("uploads", "projects", project.id, filename).replace(/\\/g, "/"),
    mimeType: "image/png",
  };
}

function formUsesNaturalStyle(visualStyle: VisualStyle): boolean {
  return (
    visualStyle === "realistic" ||
    visualStyle === "cinematic" ||
    visualStyle === "stock-footage style" ||
    visualStyle === "minimal"
  );
}

export async function generateAllSceneImages(
  project: Project,
): Promise<Scene[]> {
  if (project.scenes.length !== 5) {
    throw new Error("Need exactly 5 scenes before generating visuals.");
  }

  const updated: Scene[] = [];
  for (let i = 0; i < project.scenes.length; i++) {
    const scene = project.scenes[i];
    const file = await generateSceneImage(scene, i, project);
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
