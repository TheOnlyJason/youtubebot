import fs from "fs";
import path from "path";
import type { Project } from "@/types";
import { absFromRelative, rendersDir } from "@/lib/paths";

/** Human-readable MP4 basename from script title (e.g. "purr-fect olympic dive.mp4") */
export function sanitizeRenderBasename(title: string): string {
  let t = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^skit\s*\d+\s*[-–—:]\s*/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/[–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return t.slice(0, 100) || "short";
}

export function renderFilenameFromProject(project: Project): string {
  const raw =
    project.generatedScript?.title?.trim() ||
    project.generatedScript?.songConcept?.trim() ||
    project.generatedScript?.skitConcept?.trim() ||
    project.form.topic.trim() ||
    "short";
  return `${sanitizeRenderBasename(raw)}.mp4`;
}

/** Pick a filename in renders/ that does not overwrite another project's file */
export function resolveUniqueRenderFilename(project: Project): string {
  const preferred = renderFilenameFromProject(project);
  const preferredAbs = path.join(rendersDir(), preferred);
  if (fs.existsSync(preferredAbs)) {
    const currentAbs = project.render.outputRelativePath
      ? absFromRelative(project.render.outputRelativePath)
      : null;
    if (currentAbs && path.resolve(currentAbs) === path.resolve(preferredAbs)) {
      return preferred;
    }
  } else {
    return preferred;
  }

  const stem = preferred.replace(/\.mp4$/i, "");
  const suffix = project.id.slice(0, 8);
  const alt = `${stem} (${suffix}).mp4`;
  if (!fs.existsSync(path.join(rendersDir(), alt))) return alt;

  return `short_${project.id}.mp4`;
}

export function renderBasenameFromRelativePath(relativePath?: string): string | undefined {
  if (!relativePath?.trim()) return undefined;
  return path.basename(relativePath.replace(/\\/g, "/"));
}
