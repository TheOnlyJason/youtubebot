import fs from "fs";
import { projectsDbPath, ensureDir, dataDir } from "@/lib/paths";
import { deriveStatus } from "@/lib/projectStatus";
import type { Project, ProjectsFile } from "@/types";

function readRaw(): ProjectsFile {
  ensureDir(dataDir());
  const p = projectsDbPath();
  if (!fs.existsSync(p)) {
    const initial: ProjectsFile = { projects: [] };
    fs.writeFileSync(p, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  const raw = fs.readFileSync(p, "utf-8");
  try {
    return JSON.parse(raw) as ProjectsFile;
  } catch {
    return { projects: [] };
  }
}

export function listProjects(): Project[] {
  return readRaw().projects.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function getProject(id: string): Project | undefined {
  return readRaw().projects.find((p) => p.id === id);
}

export function saveProject(project: Project): void {
  project.status = deriveStatus(project);
  const db = readRaw();
  const idx = db.projects.findIndex((p) => p.id === project.id);
  project.updatedAt = new Date().toISOString();
  if (idx >= 0) {
    db.projects[idx] = project;
  } else {
    db.projects.push(project);
  }
  fs.writeFileSync(projectsDbPath(), JSON.stringify(db, null, 2), "utf-8");
}

export function deleteProject(id: string): boolean {
  const db = readRaw();
  const next = db.projects.filter((p) => p.id !== id);
  if (next.length === db.projects.length) return false;
  db.projects = next;
  fs.writeFileSync(projectsDbPath(), JSON.stringify(db, null, 2), "utf-8");
  return true;
}
