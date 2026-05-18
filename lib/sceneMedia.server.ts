import fs from "fs";
import type { Project, Scene } from "@/types";
import { absFromRelative } from "@/lib/paths";
import { sceneHasMediaPath } from "@/lib/sceneMedia";

/** Scene media path exists on disk (server-only). */
export function sceneHasUsableMedia(scene: Scene): boolean {
  if (!sceneHasMediaPath(scene)) return false;
  try {
    return fs.existsSync(absFromRelative(scene.media.fileRelativePath!));
  } catch {
    return false;
  }
}

/** Scene indices with no file on disk — use for Sora retry (server-only). */
export function scenesMissingUsableMedia(project: Project): number[] {
  return project.scenes
    .map((s, i) => (sceneHasUsableMedia(s) ? -1 : i))
    .filter((i) => i >= 0);
}
