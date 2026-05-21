import type { Project } from "@/types";

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

export function renderBasenameFromRelativePath(relativePath?: string): string | undefined {
  if (!relativePath?.trim()) return undefined;
  const parts = relativePath.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1];
}
