import type { Project, Scene } from "@/types";

/** True when a scene has a media path saved (Sora, upload, Pexels, etc.). Safe for client components. */
export function sceneHasMediaPath(scene: Scene): boolean {
  return Boolean(scene.media.fileRelativePath?.trim());
}

export function scenesMissingMedia(project: Project): number[] {
  return project.scenes
    .map((s, i) => (sceneHasMediaPath(s) ? -1 : i))
    .filter((i) => i >= 0);
}

export function allScenesHaveMedia(project: Project): boolean {
  return project.scenes.length === 5 && scenesMissingMedia(project).length === 0;
}
