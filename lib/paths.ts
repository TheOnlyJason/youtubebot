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
  // DB stores POSIX-style paths (uploads/...). Compare with / only so Windows path.sep does not break startsWith.
  const posix = rel.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  const parts = posix.split("/").filter(Boolean);
  if (parts[0] === "uploads") {
    return path.join(ROOT, ...parts);
  }
  if (parts[0] === "renders") {
    return path.join(ROOT, ...parts);
  }
  return path.join(uploadsDir(), ...parts);
}
