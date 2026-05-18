import fs from "fs";

/**
 * FFmpeg binary for spawn().
 * Resolution order: FFMPEG_PATH env → npm ffmpeg-static bundle → `ffmpeg` on PATH.
 */
export function getFfmpegExecutable(): string {
  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv) return fromEnv;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bundled = require("ffmpeg-static") as string | null;
    if (bundled && fs.existsSync(bundled)) return bundled;
  } catch {
    /* optional dependency missing */
  }

  return "ffmpeg";
}

export function ffmpegMissingMessage(bin: string): string {
  if (bin === "ffmpeg") {
    return [
      "ffmpeg was not found (not on PATH for this server).",
      "Run `npm install` so the bundled ffmpeg-static binary is available, or install FFmpeg system-wide.",
      "You can also set FFMPEG_PATH in .env.local to a full path to ffmpeg.exe.",
    ].join(" ");
  }
  return `FFMPEG_PATH is "${bin}" but that file does not exist or could not be run. Check the path in .env.local.`;
}

export function assertFfmpegPathExists(bin: string): void {
  if (bin === "ffmpeg") return;
  if (!fs.existsSync(bin)) {
    throw new Error(ffmpegMissingMessage(bin));
  }
}
