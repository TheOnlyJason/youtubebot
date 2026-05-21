import fs from "fs";
import path from "path";
import type { Project } from "@/types";
import { absFromRelative, rendersDir } from "@/lib/paths";
import { renderFilenameFromProject } from "@/lib/video/renderFilename";

/** Pick a filename in renders/ that does not overwrite another project's file (server only) */
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
