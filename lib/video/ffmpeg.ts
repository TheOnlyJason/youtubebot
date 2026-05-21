import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { Project, Scene } from "@/types";
import { absFromRelative, ensureDir, rendersDir } from "@/lib/paths";
import { sceneHasUsableMedia } from "@/lib/sceneMedia.server";
import {
  assertFfmpegPathExists,
  ffmpegMissingMessage,
  getFfmpegExecutable,
} from "@/lib/video/ffmpegBin";
import { resolveUniqueRenderFilename } from "@/lib/video/renderFilename.server";

function runFfmpeg(args: string[], cwd?: string): Promise<string> {
  const bin = getFfmpegExecutable();
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, {
      cwd,
      shell: false,
      windowsHide: true,
    });
    let stderr = "";
    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on("error", (err) => {
      const ne = err as NodeJS.ErrnoException;
      if (ne.code === "ENOENT") {
        reject(new Error(ffmpegMissingMessage(bin)));
        return;
      }
      reject(err);
    });
    proc.on("close", (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-4000)}`));
    });
  });
}

export function normalizeSceneDurations(
  scenes: Scene[],
  targetSeconds: number,
): Scene[] {
  if (!scenes.length) return scenes;
  const weights = scenes.map((s) => Math.max(1, s.durationSeconds));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const base = scenes.map((s, i) => ({
    ...s,
    durationSeconds: Math.max(1, Math.floor((targetSeconds * weights[i]) / wsum)),
  }));
  let used = base.reduce((a, s) => a + s.durationSeconds, 0);
  let i = 0;
  while (used < targetSeconds) {
    base[i % base.length].durationSeconds += 1;
    used++;
    i++;
  }
  while (used > targetSeconds) {
    const idx = i % base.length;
    if (base[idx].durationSeconds > 1) {
      base[idx].durationSeconds -= 1;
      used--;
    }
    i++;
    if (i > 100000) break;
  }
  return base;
}

const DEFAULT_BACKGROUNDS = [
  "0x1a1a2e",
  "0x1c2238",
  "0x1e263c",
  "0x1a2436",
  "0x182230",
] as const;

function scenePadColor(project: Project, sceneIndex: number): string {
  return (
    project.visualContinuity?.sceneBackgrounds[sceneIndex] ??
    DEFAULT_BACKGROUNDS[sceneIndex % DEFAULT_BACKGROUNDS.length]
  );
}

function padColorForFfmpeg(hex: string): string {
  return hex.replace(/^0x/i, "");
}

function sceneFadeSuffix(dur: number): string {
  const fade = Math.min(0.35, dur / 4);
  const fadeOutSt = Math.max(0, dur - fade);
  return `,fade=t=in:st=0:d=${fade},fade=t=out:st=${fadeOutSt}:d=${fade}`;
}

/** Still images only — zoompan on video uses frame 0 and looks like a frozen thumbnail */
function vfForStillImage(
  motion: Scene["motion"],
  frames: number,
  padHex: string,
  dur: number,
): string {
  const pad = padColorForFfmpeg(padHex);
  const base = `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x${pad},format=yuv420p`;
  const fades = sceneFadeSuffix(dur);
  if (motion === "fade") {
    return `${base}${fades}`;
  }
  if (motion === "zoom_in") {
    return `scale=4000:-1,zoompan=z='min(zoom+0.0018,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30,format=yuv420p${fades}`;
  }
  if (motion === "pan") {
    return `scale=4000:-1,zoompan=z=1.12:x='50+on*3':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30,format=yuv420p${fades}`;
  }
  return `${base}${fades}`;
}

/** Play Sora / stock MP4 as real video (no Ken Burns — that breaks multi-frame input) */
function vfForVideoClip(padHex: string, dur: number): string {
  const pad = padColorForFfmpeg(padHex);
  return `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x${pad},fps=30,format=yuv420p${sceneFadeSuffix(dur)}`;
}

async function probeMediaDuration(abs: string): Promise<number> {
  const bin = getFfmpegExecutable();
  return new Promise((resolve) => {
    const proc = spawn(bin, ["-hide_banner", "-i", abs], {
      windowsHide: true,
    });
    let stderr = "";
    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on("close", () => {
      const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!m) {
        resolve(0);
        return;
      }
      resolve(
        parseInt(m[1]!, 10) * 3600 +
          parseInt(m[2]!, 10) * 60 +
          parseFloat(m[3]!),
      );
    });
    proc.on("error", () => resolve(0));
  });
}

/** When Sora clip is longer than the scene slot, use the middle segment (not just the first seconds) */
function videoTrimStart(sourceDur: number, sceneDur: number): number {
  if (sourceDur <= sceneDur + 0.25) return 0;
  return Math.max(0, (sourceDur - sceneDur) / 2);
}

function buildXfadeFilter(durations: number[], fadeSec = 0.35): string {
  if (durations.length <= 1) return `[0:v]copy[outv]`;
  let acc = durations[0]!;
  let left = "0:v";
  const parts: string[] = [];
  for (let i = 1; i < durations.length; i++) {
    const offset = Math.max(0, acc - fadeSec);
    const out = i === durations.length - 1 ? "outv" : `xv${i}`;
    parts.push(
      `[${left}][${i}:v]xfade=transition=fade:duration=${fadeSec}:offset=${offset.toFixed(3)}[${out}]`,
    );
    left = out;
    acc = acc + durations[i]! - fadeSec;
  }
  return `${parts.join(";")};`;
}

async function buildSceneSegment(
  scene: Scene,
  idx: number,
  workDir: string,
  isLavfi: boolean,
  project: Project,
): Promise<string> {
  const out = path.join(workDir, `seg_${idx}.mp4`);
  const dur = scene.durationSeconds;
  const frames = Math.max(1, Math.round(dur * 30));
  const padHex = scenePadColor(project, idx);
  if (sceneHasUsableMedia(scene)) {
    const abs = absFromRelative(scene.media.fileRelativePath!);
    if (!fs.existsSync(abs)) {
      throw new Error(`Missing media file: ${scene.media.fileRelativePath}`);
    }
    const ext = path.extname(abs).toLowerCase();
    const isVideo = [".mp4", ".webm", ".mov", ".mkv"].includes(ext);
    if (isVideo) {
      const sourceDur = await probeMediaDuration(abs);
      const trimStart = videoTrimStart(sourceDur, dur);
      const vf = vfForVideoClip(padHex, dur);
      const inputArgs: string[] = ["-y"];
      if (trimStart > 0) {
        inputArgs.push("-ss", trimStart.toFixed(3));
      }
      inputArgs.push(
        "-i",
        abs,
        "-t",
        String(dur),
        "-vf",
        vf,
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        out,
      );
      await runFfmpeg(inputArgs, workDir);
    } else {
      const vf = vfForStillImage(scene.motion, frames, padHex, dur);
      await runFfmpeg(
        [
          "-y",
          "-loop",
          "1",
          "-i",
          abs,
          "-t",
          String(dur),
          "-vf",
          vf,
          "-r",
          "30",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          out,
        ],
        workDir,
      );
    }
    return out;
  }

  const vf = isLavfi
    ? `format=yuv420p${sceneFadeSuffix(dur)}`
    : vfForStillImage(scene.motion, frames, padHex, dur);

  const hex = padHex;
  await runFfmpeg(
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=${hex}:s=1080x1920:r=30`,
      "-t",
      String(dur),
      "-vf",
      vf,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      out,
    ],
    workDir,
  );
  return out;
}

function escapeAssText(text: string): string {
  return text.replace(/\n/g, " ").replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}

function buildAssTimed(scenes: Scene[]): string {
  let t = 0;
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,64,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,2,2,60,60,140,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const lines: string[] = [];
  for (const s of scenes) {
    const start = t;
    const end = t + s.durationSeconds;
    const cs = formatAssTime(start);
    const ce = formatAssTime(end);
    const cap = escapeAssText(s.caption || " ");
    lines.push(`Dialogue: 0,${cs},${ce},Default,,0,0,0,,${cap}`);
    t = end;
  }
  return header + lines.join("\n");
}

function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export interface RenderResult {
  relativeOutput: string;
  absoluteOutput: string;
}

export async function renderVerticalMp4(project: Project): Promise<RenderResult> {
  if (!project.generatedScript) throw new Error("Script required");
  if (!project.voiceover.fileRelativePath) throw new Error("Voiceover file required");
  assertFfmpegPathExists(getFfmpegExecutable());
  const voiceAbs = absFromRelative(project.voiceover.fileRelativePath);
  if (!fs.existsSync(voiceAbs)) {
    throw new Error(
      `Voiceover missing on disk (resolved: ${voiceAbs}). Re-upload or regenerate TTS.`,
    );
  }

  const target = project.form.duration;
  const scenes = normalizeSceneDurations(project.scenes, target);
  const workDir = path.join(rendersDir(), `work_${project.id}_${Date.now()}`);
  ensureDir(rendersDir());
  fs.mkdirSync(workDir, { recursive: true });

  const segments: string[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const lavfi = !sceneHasUsableMedia(s);
    const p = await buildSceneSegment(s, i, workDir, lavfi, project);
    segments.push(p);
  }

  const concatPath = path.join(workDir, "concat.mp4");
  const concatArgs = ["-y"];
  for (const seg of segments) {
    concatArgs.push("-i", seg);
  }
  const durations = scenes.map((s) => s.durationSeconds);
  const concatFilter = buildXfadeFilter(durations);
  concatArgs.push(
    "-filter_complex",
    concatFilter,
    "-map",
    "[outv]",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    concatPath,
  );
  await runFfmpeg(concatArgs, workDir);

  const assPath = path.join(workDir, "captions.ass");
  fs.writeFileSync(assPath, buildAssTimed(scenes), "utf-8");

  const outName = resolveUniqueRenderFilename(project);
  const outAbs = path.join(rendersDir(), outName);
  const assForFilter = assPath.replace(/\\/g, "/").replace(":", "\\:");

  const musicAbs =
    project.music.fileRelativePath && project.music.rightsConfirmed
      ? absFromRelative(project.music.fileRelativePath)
      : null;
  const hasMusic = musicAbs && fs.existsSync(musicAbs);

  const fadeSec = 0.35;
  const totalSeconds = Math.max(
    1,
    scenes.reduce((a, s) => a + s.durationSeconds, 0) -
      fadeSec * Math.max(0, scenes.length - 1),
  );

  if (hasMusic) {
    const mv = Math.max(0, Math.min(1, project.musicVolume));
    const vv = Math.max(0, Math.min(2, project.voiceVolume));
    const fadeOutSt = Math.max(0, totalSeconds - 0.5);
    const filter = [
      `[0:v]ass='${assForFilter}'[vout];`,
      `[1:a]volume=${vv},apad=whole_dur=${totalSeconds}[a1];`,
      `[2:a]volume=${mv},apad=whole_dur=${totalSeconds}[a2];`,
      `[a1][a2]amix=inputs=2:duration=longest:dropout_transition=0[am];`,
      `[am]afade=t=in:st=0:d=0.4,afade=t=out:st=${fadeOutSt}:d=0.4[aout]`,
    ].join("");
    await runFfmpeg(
      [
        "-y",
        "-i",
        concatPath,
        "-i",
        voiceAbs,
        "-i",
        musicAbs,
        "-filter_complex",
        filter,
        "-map",
        "[vout]",
        "-map",
        "[aout]",
        "-t",
        String(totalSeconds),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        outAbs,
      ],
      workDir,
    );
  } else {
    const vv = Math.max(0, Math.min(2, project.voiceVolume));
    const fadeOutSt = Math.max(0, totalSeconds - 0.5);
    const filter = [
      `[0:v]ass='${assForFilter}'[vout];`,
      `[1:a]volume=${vv},apad=whole_dur=${totalSeconds}[a];`,
      `[a]afade=t=in:st=0:d=0.4,afade=t=out:st=${fadeOutSt}:d=0.4[aout]`,
    ].join("");
    await runFfmpeg(
      [
        "-y",
        "-i",
        concatPath,
        "-i",
        voiceAbs,
        "-filter_complex",
        filter,
        "-map",
        "[vout]",
        "-map",
        "[aout]",
        "-t",
        String(totalSeconds),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        outAbs,
      ],
      workDir,
    );
  }

  fs.rmSync(workDir, { recursive: true, force: true });

  return {
    absoluteOutput: outAbs,
    relativeOutput: path.join("renders", outName).replace(/\\/g, "/"),
  };
}
