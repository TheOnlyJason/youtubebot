import path from "path";
import fs from "fs";

const ROOT = process.cwd();

export function uploadsDir(): string {
  return path.join(ROOT, "uploads");
}

export function rendersDir(): string {
  return path.join(ROOT, "renders");
}

export function dataDir(): string {
  return path.join(ROOT, "data");
}

export function projectsDbPath(): string {
  return path.join(dataDir(), "projects.json");
}

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Absolute path from relative upload/render path stored in DB */
export function absFromRelative(rel: string): string {
  const normalized = rel.replace(/^[/\\]+/, "").replace(/\\/g, path.sep);
  if (normalized.startsWith("uploads" + path.sep)) {
    return path.join(ROOT, normalized);
  }
  if (normalized.startsWith("renders" + path.sep)) {
    return path.join(ROOT, normalized);
  }
  return path.join(uploadsDir(), normalized);
}
