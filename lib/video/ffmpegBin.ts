import fs from "fs";

/**
 * FFmpeg binary for spawn().
 * Set FFMPEG_PATH in .env.local to the full path of ffmpeg.exe on Windows if `ffmpeg` is not on PATH.
 */
export function getFfmpegExecutable(): string {
  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv) return fromEnv;
  return "ffmpeg";
}

export function ffmpegMissingMessage(bin: string): string {
  if (bin === "ffmpeg") {
    return [
      "ffmpeg was not found (not on PATH for this server).",
      "Install FFmpeg (e.g. winget install ffmpeg, or a build from https://www.gyan.dev/ffmpeg/builds/), restart the terminal and IDE, then try again.",
      "Or set FFMPEG_PATH in .env.local to the full path of ffmpeg.exe, e.g. C:\\\\ffmpeg\\\\bin\\\\ffmpeg.exe",
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
