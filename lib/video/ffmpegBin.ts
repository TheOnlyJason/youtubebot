import fs from "fs";
import { createRequire } from "module";
import path from "path";

const require = createRequire(import.meta.url);

function bundledFfmpegFromNodeModules(): string | null {
  const name = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const fromCwd = path.join(process.cwd(), "node_modules", "ffmpeg-static", name);
  if (fs.existsSync(fromCwd)) return fromCwd;

  try {
    const fromPkg = require("ffmpeg-static") as string | null;
    if (fromPkg && fs.existsSync(fromPkg)) return fromPkg;
  } catch {
    /* not installed */
  }

  return null;
}

/**
 * FFmpeg binary for spawn().
 * Resolution order: FFMPEG_PATH env → npm ffmpeg-static bundle → `ffmpeg` on PATH.
 */
export function getFfmpegExecutable(): string {
  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv) return fromEnv;

  const bundled = bundledFfmpegFromNodeModules();
  if (bundled) return bundled;

  return "ffmpeg";
}

export function ffmpegMissingMessage(bin: string): string {
  if (bin === "ffmpeg") {
    const hint = bundledFfmpegFromNodeModules();
    const lines = [
      "ffmpeg was not found (not on PATH for this server).",
      "Run `npm install` so the bundled ffmpeg-static binary is available, or install FFmpeg system-wide.",
    ];
    if (hint) {
      lines.push(`Or add to .env: FFMPEG_PATH=${hint.replace(/\\/g, "\\\\")}`);
    } else {
      lines.push("Or set FFMPEG_PATH in .env to the full path to ffmpeg.exe.");
    }
    return lines.join(" ");
  }
  return `FFMPEG_PATH is "${bin}" but that file does not exist or could not be run. Check the path in .env.`;
}

export function assertFfmpegPathExists(bin: string): void {
  if (bin === "ffmpeg") return;
  if (!fs.existsSync(bin)) {
    throw new Error(ffmpegMissingMessage(bin));
  }
}
